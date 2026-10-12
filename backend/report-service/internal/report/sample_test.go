package report

import (
	"math/rand"
	"os"
	"testing"

	"report-service/internal/gen/reportv1"
)

// Run with SAMPLE_PDF=/path/out.pdf to write a sample for eyeballing the layout.
func TestWriteSample(t *testing.T) {
	out := os.Getenv("SAMPLE_PDF")
	if out == "" {
		t.Skip("SAMPLE_PDF not set")
	}
	rnd := rand.New(rand.NewSource(1))
	from := int64(1767312000000)
	req := &reportv1.GenerateReportRequest{FromMs: from, ToMs: from + 24*3600_000, BucketMs: 30 * 60_000}
	names := []string{"products.searched", "products.titles_listed", "products.viewed", "products.fetched", "products.imported", "products.exports_listed", "products.export_downloaded", "x.one", "x.two"}
	for i, n := range names {
		s := &reportv1.Series{Type: n}
		for ts := from; ts <= req.ToMs; ts += req.BucketMs {
			if rnd.Intn(3) != 0 {
				s.Points = append(s.Points, &reportv1.Point{TimestampMs: ts, Value: float64(rnd.Intn(40/(i+1)) + 1)})
			}
		}
		req.Series = append(req.Series, s)
	}
	pdf, _, err := NewRenderer(Options{Compress: true}).Render(req)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(out, pdf, 0o644); err != nil {
		t.Fatal(err)
	}
}
