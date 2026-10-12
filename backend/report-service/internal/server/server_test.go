package server

import (
	"context"
	"net"
	"strings"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"report-service/internal/gen/reportv1"
	"report-service/internal/report"
)

func startServer(t *testing.T) reportv1.ReportServiceClient {
	t.Helper()
	lis := bufconn.Listen(1 << 20)
	s := grpc.NewServer()
	reportv1.RegisterReportServiceServer(s, New(report.NewRenderer(report.Options{Compress: true})))
	go func() { _ = s.Serve(lis) }()
	t.Cleanup(s.Stop)
	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return lis.Dial() }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return reportv1.NewReportServiceClient(conn)
}

func TestGenerateReportReturnsAPDF(t *testing.T) {
	client := startServer(t)
	res, err := client.GenerateReport(context.Background(), &reportv1.GenerateReportRequest{
		FromMs: 0, ToMs: 3600_000, BucketMs: 60_000,
		Series: []*reportv1.Series{{Type: "a", Points: []*reportv1.Point{{TimestampMs: 0, Value: 3}}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(res.Pdf), "%PDF-") || !strings.HasSuffix(res.Filename, ".pdf") {
		t.Fatalf("unexpected response: %q %q", res.Pdf[:5], res.Filename)
	}
}

func TestGenerateReportMapsInvalidRequestsToInvalidArgument(t *testing.T) {
	client := startServer(t)
	_, err := client.GenerateReport(context.Background(), &reportv1.GenerateReportRequest{FromMs: 10, ToMs: 5, BucketMs: 1000})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("got %v", err)
	}
}
