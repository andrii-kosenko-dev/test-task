# Context is ./backend so the shared proto is reachable: docker build -f report-service/Dockerfile backend
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY report-service/go.mod report-service/go.sum ./
RUN go mod download
COPY report-service/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/report-service ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/report-service /report-service
EXPOSE 50051
ENTRYPOINT ["/report-service"]
