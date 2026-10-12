package report

import (
	"reflect"
	"testing"

	"report-service/internal/gen/reportv1"
)

func pt(ts int64, v float64) *reportv1.Point { return &reportv1.Point{TimestampMs: ts, Value: v} }

func TestDensifyFillsMissingBucketsWithZero(t *testing.T) {
	got := Densify([]*reportv1.Point{pt(1000, 2), pt(3000, 5)}, 0, 4500, 1000)
	want := []Bucket{{0, 0}, {1000, 2}, {2000, 0}, {3000, 5}, {4000, 0}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestDensifyAlignsStartToBucketGrid(t *testing.T) {
	got := Densify(nil, 1500, 3200, 1000)
	if len(got) != 3 || got[0].Start != 1000 || got[2].Start != 3000 {
		t.Fatalf("unexpected buckets %v", got)
	}
}

func TestDensifyIgnoresPointsOutsideTheRangeAndSumsDuplicates(t *testing.T) {
	got := Densify([]*reportv1.Point{pt(-1000, 9), pt(1000, 1), pt(1000, 2), pt(99000, 9)}, 0, 2000, 1000)
	want := []Bucket{{0, 0}, {1000, 3}, {2000, 0}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestSummarizeTotalsSharesAndPeaks(t *testing.T) {
	series := []*reportv1.Series{
		{Type: "a", Points: []*reportv1.Point{pt(0, 1), pt(1000, 3)}},
		{Type: "b", Points: []*reportv1.Point{pt(0, 6)}},
	}
	s := Summarize(series, 0, 1000, 1000)
	if s.Total != 10 {
		t.Fatalf("total %v", s.Total)
	}
	if s.PerType[0].Type != "b" || s.PerType[0].Total != 6 || s.PerType[0].Share != 60 {
		t.Fatalf("sorted by total desc expected, got %+v", s.PerType)
	}
	if s.PerType[1].PeakAt != 1000 || s.PerType[1].Peak != 3 {
		t.Fatalf("peak %+v", s.PerType[1])
	}
	if s.BusiestAt != 0 || s.BusiestValue != 7 {
		t.Fatalf("busiest bucket %v/%v", s.BusiestAt, s.BusiestValue)
	}
}

func TestSummarizeEmpty(t *testing.T) {
	s := Summarize(nil, 0, 1000, 1000)
	if s.Total != 0 || len(s.PerType) != 0 {
		t.Fatalf("%+v", s)
	}
}

func TestNiceScale(t *testing.T) {
	cases := []struct{ in, wantMax, wantStep float64 }{
		{0, 5, 1}, {1, 5, 1}, {7, 8, 2}, {13, 15, 5}, {99, 100, 20}, {1234, 1500, 500},
	}
	for _, c := range cases {
		max, step := NiceScale(c.in)
		if max != c.wantMax || step != c.wantStep {
			t.Errorf("NiceScale(%v) = %v,%v want %v,%v", c.in, max, step, c.wantMax, c.wantStep)
		}
	}
}

func TestFormatTick(t *testing.T) {
	ts := int64(1767312000000 + 3*3600_000 + 4*60_000) // 2026-01-02 03:04 UTC
	if got := FormatTick(ts, 6*3600_000); got != "03:04" {
		t.Errorf("short range: %q", got)
	}
	if got := FormatTick(ts, 5*24*3600_000); got != "Jan 02 03:04" {
		t.Errorf("multi-day: %q", got)
	}
	if got := FormatTick(ts, 90*24*3600_000); got != "Jan 02" {
		t.Errorf("long range: %q", got)
	}
}

func TestFormatBucket(t *testing.T) {
	cases := map[int64]string{1000: "1 s", 30000: "30 s", 60000: "1 min", 900000: "15 min", 3600000: "1 h", 86400000: "1 d", 5400000: "90 min"}
	for in, want := range cases {
		if got := FormatBucket(in); got != want {
			t.Errorf("FormatBucket(%d) = %q want %q", in, got, want)
		}
	}
}
