.PHONY: proto test build

# Regenerate the gRPC stubs from the shared contract (needs protoc, protoc-gen-go, protoc-gen-go-grpc).
proto:
	protoc -I ../proto --go_out=. --go_opt=module=report-service \
		--go-grpc_out=. --go-grpc_opt=module=report-service ../proto/report.proto

test:
	go test ./...

build:
	go build -o bin/report-service ./cmd/server
