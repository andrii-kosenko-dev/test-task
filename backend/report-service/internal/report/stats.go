// Package report renders the time series report: statistics (this file) and PDF drawing.
package report

import (
	"fmt"
	"math"
	"sort"
	"time"

	"report-service/internal/gen/reportv1"
)

// Bucket is one aggregation interval: its start (epoch ms) and event count.
type Bucket struct {
	Start int64
	Value float64
}

// TypeStat summarises one event type.
type TypeStat struct {
	Type   string
	Total  float64
	Share  float64 // percent of all events
	Peak   float64
	PeakAt int64
}

// Summary summarises a whole report.
type Summary struct {
	Total        float64
	PerType      []TypeStat // sorted by Total, descending
	BusiestAt    int64
	BusiestValue float64
}

// Densify turns sparse points into one bucket per interval over [from, to].
// RedisTimeSeries omits empty buckets, so missing ones are filled with zero.
func Densify(points []*reportv1.Point, from, to, bucketMs int64) []Bucket {
	if bucketMs <= 0 || to < from {
		return nil
	}
	start := floorDiv(from, bucketMs) * bucketMs
	n := int((to-start)/bucketMs) + 1
	buckets := make([]Bucket, n)
	for i := range buckets {
		buckets[i].Start = start + int64(i)*bucketMs
	}
	for _, p := range points {
		if p.TimestampMs < start || p.TimestampMs > to {
			continue
		}
		buckets[(p.TimestampMs-start)/bucketMs].Value += p.Value
	}
	return buckets
}

func floorDiv(a, b int64) int64 {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

// Summarize computes totals, shares, per-type peaks and the busiest bucket overall.
func Summarize(series []*reportv1.Series, from, to, bucketMs int64) Summary {
	var s Summary
	var combined []Bucket
	for _, ser := range series {
		dense := Densify(ser.Points, from, to, bucketMs)
		stat := TypeStat{Type: ser.Type}
		for i, b := range dense {
			stat.Total += b.Value
			if b.Value > stat.Peak {
				stat.Peak, stat.PeakAt = b.Value, b.Start
			}
			if len(combined) <= i {
				combined = append(combined, Bucket{Start: b.Start})
			}
			combined[i].Value += b.Value
		}
		s.Total += stat.Total
		s.PerType = append(s.PerType, stat)
	}
	for i := range s.PerType {
		if s.Total > 0 {
			s.PerType[i].Share = s.PerType[i].Total / s.Total * 100
		}
	}
	sort.SliceStable(s.PerType, func(i, j int) bool { return s.PerType[i].Total > s.PerType[j].Total })
	for _, b := range combined {
		if b.Value > s.BusiestValue {
			s.BusiestValue, s.BusiestAt = b.Value, b.Start
		}
	}
	return s
}

// NiceScale returns an axis maximum and tick step so the axis has at most five round intervals.
func NiceScale(maxValue float64) (max, step float64) {
	if maxValue <= 5 {
		return 5, 1
	}
	for exp := 1.0; ; exp *= 10 {
		for _, m := range []float64{1, 2, 5} {
			step = m * exp
			if math.Ceil(maxValue/step) <= 5 {
				return math.Ceil(maxValue/step) * step, step
			}
		}
	}
}

// FormatTick labels an x-axis tick; detail shrinks as the range grows.
func FormatTick(tsMs, rangeMs int64) string {
	t := time.UnixMilli(tsMs).UTC()
	switch {
	case rangeMs <= 24*3600_000:
		return t.Format("15:04")
	case rangeMs <= 14*24*3600_000:
		return t.Format("Jan 02 15:04")
	default:
		return t.Format("Jan 02")
	}
}

// FormatBucket renders a bucket size such as "15 min" or "1 h".
func FormatBucket(ms int64) string {
	switch {
	case ms%86400000 == 0:
		return fmt.Sprintf("%d d", ms/86400000)
	case ms%3600000 == 0:
		return fmt.Sprintf("%d h", ms/3600000)
	case ms%60000 == 0:
		return fmt.Sprintf("%d min", ms/60000)
	case ms%1000 == 0:
		return fmt.Sprintf("%d s", ms/1000)
	default:
		return fmt.Sprintf("%d ms", ms)
	}
}
