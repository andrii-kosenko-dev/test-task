package report

import (
	"bytes"
	"errors"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"

	"report-service/internal/gen/reportv1"
)

// Options configure the renderer.
type Options struct {
	// Compress deflates page streams. Disable only to inspect output in tests.
	Compress bool
}

// Renderer draws report PDFs.
type Renderer struct{ opts Options }

// NewRenderer creates a Renderer.
func NewRenderer(opts Options) *Renderer { return &Renderer{opts: opts} }

const (
	maxBuckets     = 5000
	maxLineSeries  = 6
	maxBarRows     = 10
	pageW          = 210.0
	pageH          = 297.0
	margin         = 15.0
	contentW       = pageW - 2*margin
	bottomLimit    = pageH - 20
	emptyStateText = "No events in this period"
)

// palette: distinct hues readable on white, and distinguishable in greyscale by line/bar order.
var palette = [][3]int{
	{37, 99, 235}, {220, 38, 38}, {22, 163, 74}, {217, 119, 6},
	{147, 51, 234}, {8, 145, 178}, {219, 39, 119}, {101, 109, 118},
}

var (
	ink    = [3]int{17, 24, 39}
	muted  = [3]int{107, 114, 128}
	grid   = [3]int{229, 231, 235}
	panel  = [3]int{243, 244, 246}
	accent = [3]int{37, 99, 235}
)

type displaySeries struct {
	Name    string
	Buckets []Bucket
	Color   [3]int
}

// Render validates the request and returns the PDF bytes and a suggested filename.
func (r *Renderer) Render(req *reportv1.GenerateReportRequest) ([]byte, string, error) {
	if err := validate(req); err != nil {
		return nil, "", err
	}
	title := req.Title
	if title == "" {
		title = "Event report"
	}
	summary := Summarize(req.Series, req.FromMs, req.ToMs, req.BucketMs)

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetCompression(r.opts.Compress)
	pdf.SetTitle(title, true)
	pdf.SetAuthor("report-service", true)
	pdf.SetMargins(margin, margin, margin)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AliasNbPages("")
	generated := time.Now().UTC().Format("2006-01-02 15:04 UTC")
	pdf.SetFooterFunc(func() {
		pdf.SetY(-12)
		setText(pdf, muted, "", 8)
		pdf.CellFormat(contentW/2, 5, "Generated "+generated, "", 0, "L", false, 0, "")
		pdf.CellFormat(contentW/2, 5, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "R", false, 0, "")
	})
	pdf.AddPage()

	drawHeader(pdf, title, req)
	drawKPIs(pdf, summary, len(req.Series), req.BucketMs)

	section(pdf, "Events over time")
	if summary.Total == 0 {
		emptyState(pdf, 70)
	} else {
		lineChart(pdf, req, displayLines(req, summary))
	}

	ensureSpace(pdf, 20+float64(min(len(summary.PerType), maxBarRows))*8)
	section(pdf, "Events by type")
	if summary.Total == 0 {
		emptyState(pdf, 20)
	} else {
		barChart(pdf, summary)
	}

	if summary.Total > 0 {
		ensureSpace(pdf, 40)
		section(pdf, "Breakdown")
		table(pdf, summary)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", fmt.Errorf("render pdf: %w", err)
	}
	return buf.Bytes(), filename(req), nil
}

// ErrInvalidRequest marks failures caused by the request rather than the renderer.
var ErrInvalidRequest = errors.New("invalid report request")

func validate(req *reportv1.GenerateReportRequest) error {
	switch {
	case req.BucketMs <= 0:
		return fmt.Errorf("%w: bucket_ms must be positive", ErrInvalidRequest)
	case req.ToMs < req.FromMs:
		return fmt.Errorf("%w: to_ms must not be before from_ms", ErrInvalidRequest)
	case (req.ToMs-req.FromMs)/req.BucketMs+1 > maxBuckets:
		return fmt.Errorf("%w: range spans more than %d buckets; use a larger bucket_ms", ErrInvalidRequest, maxBuckets)
	}
	return nil
}

func filename(req *reportv1.GenerateReportRequest) string {
	const layout = "20060102T1504Z"
	return fmt.Sprintf("report-%s-%s.pdf",
		time.UnixMilli(req.FromMs).UTC().Format(layout), time.UnixMilli(req.ToMs).UTC().Format(layout))
}

func setText(pdf *fpdf.Fpdf, c [3]int, style string, size float64) {
	pdf.SetTextColor(c[0], c[1], c[2])
	pdf.SetFont("Helvetica", style, size)
}

func ensureSpace(pdf *fpdf.Fpdf, needed float64) {
	if pdf.GetY()+needed > bottomLimit {
		pdf.AddPage()
	}
}

func drawHeader(pdf *fpdf.Fpdf, title string, req *reportv1.GenerateReportRequest) {
	pdf.SetFillColor(accent[0], accent[1], accent[2])
	pdf.Rect(0, 0, pageW, 4, "F")
	pdf.SetY(margin)
	setText(pdf, ink, "B", 22)
	pdf.CellFormat(contentW, 10, title, "", 1, "L", false, 0, "")
	setText(pdf, muted, "", 10)
	const layout = "2006-01-02 15:04"
	period := fmt.Sprintf("Period: %s to %s UTC   |   Interval: %s",
		time.UnixMilli(req.FromMs).UTC().Format(layout), time.UnixMilli(req.ToMs).UTC().Format(layout), FormatBucket(req.BucketMs))
	pdf.CellFormat(contentW, 6, period, "", 1, "L", false, 0, "")
	pdf.Ln(4)
}

func drawKPIs(pdf *fpdf.Fpdf, s Summary, types int, bucketMs int64) {
	const gap = 4.0
	w := (contentW - 2*gap) / 3
	y := pdf.GetY()
	busiest := "-"
	if s.BusiestValue > 0 {
		busiest = fmt.Sprintf("%.0f at %s", s.BusiestValue, time.UnixMilli(s.BusiestAt).UTC().Format("Jan 02 15:04"))
	}
	cards := []struct{ label, value string }{
		{"Total events", fmt.Sprintf("%.0f", s.Total)},
		{"Event types", fmt.Sprintf("%d", types)},
		{"Busiest " + FormatBucket(bucketMs), busiest},
	}
	for i, c := range cards {
		x := margin + float64(i)*(w+gap)
		pdf.SetFillColor(panel[0], panel[1], panel[2])
		pdf.RoundedRect(x, y, w, 20, 2, "1234", "F")
		pdf.SetXY(x+3, y+3)
		setText(pdf, muted, "", 8)
		pdf.CellFormat(w-6, 4, c.label, "", 2, "L", false, 0, "")
		setText(pdf, ink, "B", 13)
		pdf.CellFormat(w-6, 8, c.value, "", 0, "L", false, 0, "")
	}
	pdf.SetY(y + 20 + 6)
}

func section(pdf *fpdf.Fpdf, name string) {
	pdf.SetX(margin)
	setText(pdf, ink, "B", 13)
	pdf.CellFormat(contentW, 8, name, "", 1, "L", false, 0, "")
}

func emptyState(pdf *fpdf.Fpdf, h float64) {
	y := pdf.GetY()
	pdf.SetFillColor(panel[0], panel[1], panel[2])
	pdf.RoundedRect(margin, y, contentW, h, 2, "1234", "F")
	pdf.SetXY(margin, y+h/2-3)
	setText(pdf, muted, "I", 10)
	pdf.CellFormat(contentW, 6, emptyStateText, "", 0, "C", false, 0, "")
	pdf.SetY(y + h + 6)
}

// displayLines keeps the busiest series and folds the rest into one "Other" line, so the legend stays readable.
func displayLines(req *reportv1.GenerateReportRequest, s Summary) []displaySeries {
	byType := make(map[string]*reportv1.Series, len(req.Series))
	for _, ser := range req.Series {
		byType[ser.Type] = ser
	}
	var out []displaySeries
	var rest []*reportv1.Point
	others := 0
	for i, stat := range s.PerType {
		ser := byType[stat.Type]
		if i < maxLineSeries {
			out = append(out, displaySeries{Name: stat.Type, Buckets: Densify(ser.Points, req.FromMs, req.ToMs, req.BucketMs), Color: palette[i%len(palette)]})
			continue
		}
		rest = append(rest, ser.Points...)
		others++
	}
	if others > 0 {
		out = append(out, displaySeries{
			Name:    fmt.Sprintf("Other (%d types)", others),
			Buckets: Densify(rest, req.FromMs, req.ToMs, req.BucketMs),
			Color:   palette[len(palette)-1],
		})
	}
	return out
}

func lineChart(pdf *fpdf.Fpdf, req *reportv1.GenerateReportRequest, lines []displaySeries) {
	const (
		plotH     = 62.0
		leftPad   = 18.0
		rightPad  = 4.0
		axisLabel = 14.0
	)
	var maxV float64
	for _, l := range lines {
		for _, b := range l.Buckets {
			maxV = max(maxV, b.Value)
		}
	}
	axisMax, step := NiceScale(maxV)

	top := pdf.GetY() + 2
	plotX, plotW := margin+leftPad, contentW-leftPad-rightPad
	yOf := func(v float64) float64 { return top + plotH - v/axisMax*plotH }

	// Grid and y labels.
	pdf.SetLineWidth(0.2)
	for v := 0.0; v <= axisMax+1e-9; v += step {
		pdf.SetDrawColor(grid[0], grid[1], grid[2])
		pdf.Line(plotX, yOf(v), plotX+plotW, yOf(v))
		setText(pdf, muted, "", 8)
		pdf.SetXY(margin+4, yOf(v)-2)
		pdf.CellFormat(leftPad-6, 4, fmt.Sprintf("%.0f", v), "", 0, "R", false, 0, "")
	}

	// X axis: evenly spaced ticks across the range.
	n := len(lines[0].Buckets)
	xOf := func(i int) float64 {
		if n <= 1 {
			return plotX + plotW/2
		}
		return plotX + float64(i)/float64(n-1)*plotW
	}
	rangeMs := req.ToMs - req.FromMs
	ticks := min(6, n)
	for k := 0; k < ticks; k++ {
		i := 0
		if ticks > 1 {
			i = k * (n - 1) / (ticks - 1)
		}
		x := xOf(i)
		pdf.SetDrawColor(ink[0], ink[1], ink[2])
		pdf.Line(x, top+plotH, x, top+plotH+1.5)
		setText(pdf, muted, "", 8)
		pdf.SetXY(x-10, top+plotH+2)
		pdf.CellFormat(20, 4, FormatTick(lines[0].Buckets[i].Start, rangeMs), "", 0, "C", false, 0, "")
	}
	pdf.SetDrawColor(ink[0], ink[1], ink[2])
	pdf.SetLineWidth(0.3)
	pdf.Line(plotX, top+plotH, plotX+plotW, top+plotH)
	pdf.Line(plotX, top, plotX, top+plotH)

	// Series.
	for _, l := range lines {
		pdf.SetDrawColor(l.Color[0], l.Color[1], l.Color[2])
		pdf.SetFillColor(l.Color[0], l.Color[1], l.Color[2])
		pdf.SetLineWidth(0.6)
		for i := 1; i < n; i++ {
			pdf.Line(xOf(i-1), yOf(l.Buckets[i-1].Value), xOf(i), yOf(l.Buckets[i].Value))
		}
		if n <= 40 {
			for i := 0; i < n; i++ {
				pdf.Circle(xOf(i), yOf(l.Buckets[i].Value), 0.7, "F")
			}
		}
	}

	// Axis titles.
	setText(pdf, muted, "", 8)
	pdf.SetXY(plotX, top+plotH+7)
	pdf.CellFormat(plotW, 4, "Time (UTC)", "", 0, "C", false, 0, "")
	yTitle := "Events per " + FormatBucket(req.BucketMs)
	cx, cy := margin+2, top+plotH/2
	pdf.TransformBegin()
	pdf.TransformRotate(90, cx, cy)
	pdf.Text(cx-pdf.GetStringWidth(yTitle)/2, cy, yTitle) // Text, not Cell: negative x would wrap to the right edge
	pdf.TransformEnd()

	// Legend, wrapping onto new rows.
	pdf.SetY(top + plotH + axisLabel + 2)
	legend(pdf, lines)
	pdf.Ln(4)
}

func legend(pdf *fpdf.Fpdf, lines []displaySeries) {
	x, y := margin, pdf.GetY()
	setText(pdf, ink, "", 8)
	for _, l := range lines {
		w := pdf.GetStringWidth(l.Name) + 10
		if x+w > margin+contentW {
			x, y = margin, y+5
		}
		pdf.SetFillColor(l.Color[0], l.Color[1], l.Color[2])
		pdf.Rect(x, y+0.8, 3, 3, "F")
		pdf.SetXY(x+4.5, y)
		pdf.CellFormat(w-4.5, 4.6, l.Name, "", 0, "L", false, 0, "")
		x += w + 3
	}
	pdf.SetY(y + 6)
}

func barChart(pdf *fpdf.Fpdf, s Summary) {
	const (
		rowH     = 8.0
		labelW   = 52.0
		valueW   = 22.0
		barH     = 5.0
		barAreaW = contentW - labelW - valueW
	)
	rows := s.PerType
	var otherTotal float64
	if len(rows) > maxBarRows {
		for _, r := range rows[maxBarRows:] {
			otherTotal += r.Total
		}
		rows = append([]TypeStat{}, rows[:maxBarRows]...)
		rows = append(rows, TypeStat{Type: fmt.Sprintf("Other (%d types)", len(s.PerType)-maxBarRows), Total: otherTotal})
	}
	maxV := rows[0].Total
	for _, r := range rows {
		maxV = max(maxV, r.Total)
	}
	y := pdf.GetY() + 1
	for i, r := range rows {
		c := palette[i%len(palette)]
		setText(pdf, ink, "", 9)
		pdf.SetXY(margin, y+(rowH-5)/2)
		pdf.CellFormat(labelW-2, 5, r.Type, "", 0, "L", false, 0, "")
		pdf.SetFillColor(grid[0], grid[1], grid[2])
		pdf.Rect(margin+labelW, y+(rowH-barH)/2, barAreaW, barH, "F")
		pdf.SetFillColor(c[0], c[1], c[2])
		pdf.Rect(margin+labelW, y+(rowH-barH)/2, max(0.6, r.Total/maxV*barAreaW), barH, "F")
		setText(pdf, ink, "B", 9)
		pdf.SetXY(margin+labelW+barAreaW+2, y+(rowH-5)/2)
		pdf.CellFormat(valueW-2, 5, fmt.Sprintf("%.0f", r.Total), "", 0, "L", false, 0, "")
		y += rowH
	}
	pdf.SetY(y + 4)
}

func table(pdf *fpdf.Fpdf, s Summary) {
	cols := []struct {
		head  string
		w     float64
		align string
	}{{"Event type", 62, "L"}, {"Total events", 28, "R"}, {"Share", 22, "R"}, {"Peak / interval", 30, "R"}, {"Peak at (UTC)", 38, "R"}}
	head := func() {
		pdf.SetX(margin)
		pdf.SetFillColor(ink[0], ink[1], ink[2])
		setText(pdf, [3]int{255, 255, 255}, "B", 9)
		for _, c := range cols {
			pdf.CellFormat(c.w, 7, c.head, "", 0, c.align, true, 0, "")
		}
		pdf.Ln(-1)
	}
	head()
	for i, r := range s.PerType {
		if pdf.GetY()+7 > bottomLimit {
			pdf.AddPage()
			head()
		}
		fill := i%2 == 1
		pdf.SetFillColor(panel[0], panel[1], panel[2])
		setText(pdf, ink, "", 9)
		peakAt := "-"
		if r.Peak > 0 {
			peakAt = time.UnixMilli(r.PeakAt).UTC().Format("Jan 02 15:04")
		}
		cells := []string{r.Type, fmt.Sprintf("%.0f", r.Total), fmt.Sprintf("%.1f%%", r.Share), fmt.Sprintf("%.0f", r.Peak), peakAt}
		pdf.SetX(margin)
		for j, c := range cols {
			pdf.CellFormat(c.w, 6.5, cells[j], "", 0, c.align, fill, 0, "")
		}
		pdf.Ln(-1)
	}
}
