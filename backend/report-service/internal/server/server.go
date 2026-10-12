// Package server exposes the renderer over gRPC.
package server

import (
	"context"
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"report-service/internal/gen/reportv1"
	"report-service/internal/report"
)

// Server implements reportv1.ReportServiceServer.
type Server struct {
	reportv1.UnimplementedReportServiceServer
	renderer *report.Renderer
}

// New creates a Server around a renderer.
func New(r *report.Renderer) *Server { return &Server{renderer: r} }

// GenerateReport renders the PDF. Request validation failures are the caller's fault.
func (s *Server) GenerateReport(ctx context.Context, req *reportv1.GenerateReportRequest) (*reportv1.GenerateReportResponse, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	pdf, name, err := s.renderer.Render(req)
	if err != nil {
		if errors.Is(err, report.ErrInvalidRequest) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &reportv1.GenerateReportResponse{Pdf: pdf, Filename: name}, nil
}
