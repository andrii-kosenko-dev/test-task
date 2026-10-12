import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { diskStorage } from 'multer';
import { EVENT_TYPES, normalizePage } from '@app/common';
import { EmitsEvent } from '@app/messaging';
import { ExportService, ExportedFile } from '../fetch/export.service';
import { detectFormat, readProductRows } from '../files/product-files';
import { CatalogService, SyncResult } from './catalog.service';
import { FetchQueryDto, FileUploadDto, ProductDto, ProductPageDto, SearchQueryDto } from './dto';
import { ImportResult, ImportService } from './import.service';
import type { Product } from './product.model';
import { ProductsRepository } from './products.repository';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type Upload = { path: string; originalname: string };

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly importer: ImportService,
    private readonly catalog: CatalogService,
    private readonly exports: ExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search products (indexed prefix search, ranked, paged)' })
  @ApiOkResponse({ type: ProductPageDto })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_SEARCHED, ({ request, result }) => ({
    q: (request as { query: SearchQueryDto }).query.q ?? '',
    total: (result as { total?: number } | undefined)?.total,
  }))
  async search(@Query() query: SearchQueryDto): Promise<ProductPageDto> {
    const { page, pageSize } = normalizePage(query.page, query.pageSize);
    const result = await this.repository.search(query.q ?? '', page, pageSize);
    return { items: result.items as Product[] as ProductDto[], total: result.total, page, pageSize };
  }

  @Get('titles')
  @ApiOperation({ summary: 'All product titles (typeahead index source)' })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_TITLES_LISTED)
  titles(): Promise<string[]> {
    return this.repository.titles();
  }

  @Post('fetch')
  @ApiOperation({
    summary: 'Download the catalogue from the public DummyJSON API into JSON and XLSX files',
    description: 'Pass import=true to also load it into Mongo.',
  })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_FETCHED, ({ result }) => ({
    count: (result as SyncResult | undefined)?.export.count,
    imported: (result as SyncResult | undefined)?.import !== null,
  }))
  fetch(@Query() query: FetchQueryDto): Promise<SyncResult> {
    return this.catalog.syncFromPublicApi(query.import ?? false);
  }

  @Get('exports')
  @ApiOperation({ summary: 'List saved export files, newest first' })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_EXPORTS_LISTED)
  listExports(): Promise<ExportedFile[]> {
    return this.exports.list();
  }

  @Get('exports/:name')
  @ApiOperation({ summary: 'Download a saved export file' })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_EXPORT_DOWNLOADED, ({ request }) => ({
    name: (request as { params: { name: string } }).params.name,
  }))
  download(@Param('name') name: string, @Res({ passthrough: true }) res: Response): StreamableFile {
    let path: string;
    try {
      path = this.exports.resolve(name);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    res.set({
      'Content-Type':
        detectFormat(name) === 'json'
          ? 'application/json'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
    });
    return new StreamableFile(createReadStream(path));
  }

  @Post('import')
  @ApiOperation({
    summary: 'Upload a JSON or XLSX file and upsert its products into Mongo',
    description: 'Rows are validated one by one; invalid rows are reported, valid ones are stored in batches. Re-uploading is idempotent.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileUploadDto })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_IMPORTED, ({ result }) => {
    const r = result as ImportResult | undefined;
    return { received: r?.received, inserted: r?.inserted, updated: r?.updated, invalid: r?.invalidCount };
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: tmpdir() }),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        try {
          detectFormat(file.originalname);
          cb(null, true);
        } catch (err) {
          cb(new BadRequestException((err as Error).message), false);
        }
      },
    }),
  )
  async import(@UploadedFile() file: Upload | undefined): Promise<ImportResult> {
    if (!file) throw new BadRequestException('Attach a .json or .xlsx file in the "file" field');
    try {
      return await this.importer.import(readProductRows(file.path, detectFormat(file.originalname)));
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Could not parse ${file.originalname}: ${(err as Error).message}`);
    } finally {
      await rm(file.path, { force: true });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'One product by id' })
  @ApiOkResponse({ type: ProductDto })
  @EmitsEvent(EVENT_TYPES.PRODUCTS_VIEWED, ({ request }) => ({
    id: Number((request as { params: { id: string } }).params.id),
  }))
  async byId(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }
}
