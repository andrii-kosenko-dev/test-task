import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { TimeSeriesService } from '@app/redis';
import { chooseBucketMs } from './bucket';

export const REPORT_GRPC_CLIENT = Symbol('REPORT_GRPC_CLIENT');
export const CLOCK = Symbol('CLOCK');

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GenerateReportRequest {
  title: string;
  fromMs: number;
  toMs: number;
  bucketMs: number;
  series: { type: string; points: { timestampMs: number; value: number }[] }[];
}

export interface GenerateReportResponse {
  pdf: Uint8Array;
  filename: string;
}

interface ReportGrpc {
  generateReport(request: GenerateReportRequest): Observable<GenerateReportResponse>;
}

export interface ReportOptions {
  readonly from?: number;
  readonly to?: number;
  readonly bucketMs?: number;
}

export interface Pdf {
  readonly data: Buffer;
  readonly filename: string;
}

@Injectable()
export class ReportService implements OnModuleInit {
  private grpc!: ReportGrpc;

  constructor(
    private readonly timeSeries: TimeSeriesService,
    @Inject(REPORT_GRPC_CLIENT) private readonly client: ClientGrpc,
    @Inject(CLOCK) private readonly now: () => number = Date.now,
  ) {}

  onModuleInit(): void {
    this.grpc = this.client.getService<ReportGrpc>('ReportService');
  }

  async generate(options: ReportOptions): Promise<Pdf> {
    const to = options.to ?? this.now();
    const from = options.from ?? to - DAY_MS;
    if (from > to) throw new Error('"from" must not be after "to"');
    const bucketMs = options.bucketMs ?? chooseBucketMs(to - from);

    const series = await this.timeSeries.queryEvents({ from, to, bucketMs });
    const response = await firstValueFrom(
      this.grpc.generateReport({
        title: 'Event activity report',
        fromMs: from,
        toMs: to,
        bucketMs,
        series: series.map((s) => ({
          type: s.type,
          points: s.points.map((p) => ({ timestampMs: p.timestamp, value: p.value })),
        })),
      }),
    );
    return { data: Buffer.from(response.pdf), filename: response.filename || 'report.pdf' };
  }
}
