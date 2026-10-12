package report

import (
	"bytes"
	"regexp"
	"strings"
	"testing"

	"report-service/internal/gen/reportv1"
)

func sampleRequest() *reportv1.GenerateReportRequest {
	return &reportv1.GenerateReportRequest{
		Title:    "Event activity report",
		FromMs:   1767312000000,
		ToMs:     1767312000000 + 6*3600_000,
		BucketMs: 600_000,
		Series: []*reportv1.Series{
			{Type: "products.searched", Points: []*reportv1.Point{pt(1767312000000, 4), pt(1767312600000, 9), pt(1767315600000, 2)}},
			{Type: "products.viewed", Points: []*reportv1.Point{pt(1767313200000, 3)}},
		},
	}
}

func TestRenderProducesAValidPDFWithLabelledCharts(t *testing.T) {
	r := NewRenderer(Options{Compress: false})
	pdf, filename, err := r.Render(sampleRequest())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(pdf, []byte("%PDF-")) || !bytes.HasSuffix(bytes.TrimSpace(pdf), []byte("%%EOF")) {
		t.Fatalf("not a PDF: %q ... %q", pdf[:8], pdf[len(pdf)-8:])
	}
	text := strings.ReplaceAll(string(pdf), `\`, "") // PDF strings escape parentheses
	for _, want := range []string{
		"Event activity report", "Events over time", "Events by type", "Time (UTC)",
		"Events per 10 min", "products.searched", "products.viewed", "Total events", "Share",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("PDF is missing label %q", want)
		}
	}
	if filename != "report-20260102T0000Z-20260102T0600Z.pdf" {
		t.Errorf("filename %q", filename)
	}
}

func TestRenderHandlesNoData(t *testing.T) {
	req := sampleRequest()
	req.Series = nil
	pdf, _, err := NewRenderer(Options{Compress: false}).Render(req)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(pdf), "No events in this period") {
		t.Error("expected an empty-state message")
	}
}

func TestRenderPaginatesManyTypes(t *testing.T) {
	req := sampleRequest()
	for i := 0; i < 60; i++ {
		req.Series = append(req.Series, &reportv1.Series{Type: "type." + string(rune('a'+i%26)) + string(rune('a'+i/26)), Points: []*reportv1.Point{pt(1767312000000, float64(i+1))}})
	}
	pdf, _, err := NewRenderer(Options{Compress: true}).Render(req)
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile(`/Count (\d+)`).FindSubmatch(pdf)
	if m == nil || string(m[1]) == "1" {
		t.Fatalf("expected the long breakdown table to spill onto more than one page, got %q", m)
	}
}

func TestRenderValidatesTheRequest(t *testing.T) {
	cases := map[string]func(*reportv1.GenerateReportRequest){
		"inverted range":   func(r *reportv1.GenerateReportRequest) { r.FromMs, r.ToMs = r.ToMs, r.FromMs },
		"zero bucket":      func(r *reportv1.GenerateReportRequest) { r.BucketMs = 0 },
		"too many buckets": func(r *reportv1.GenerateReportRequest) { r.BucketMs = 1 },
	}
	for name, mutate := range cases {
		req := sampleRequest()
		mutate(req)
		if _, _, err := NewRenderer(Options{}).Render(req); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestRenderDefaultsTheTitle(t *testing.T) {
	req := sampleRequest()
	req.Title = ""
	pdf, _, err := NewRenderer(Options{Compress: false}).Render(req)
	if err != nil || !strings.Contains(string(pdf), "Event report") {
		t.Fatalf("err=%v", err)
	}
}
