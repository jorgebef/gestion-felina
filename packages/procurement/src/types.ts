/**
 * Source-agnostic contract between connectors (PLACSP today; TED, regional platforms
 * or BOE later) and the import pipeline. A connector only fetches and normalises;
 * persistence, deduplication and change detection live in ./pipeline.ts.
 */
import type { JsonObject } from "@licita/db";
import type { ExecutionScope } from "@licita/domain/provinces";
import type { ContractType, TenderStatusValue } from "@licita/domain/tenders";

export interface NormalizedAuthority {
  name: string;
  /** Stable id of the authority in the source platform, when published. */
  platformId?: string;
  taxId?: string;
  dir3?: string;
  administrationType?: string;
  provinceCode?: string;
  municipality?: string;
  profileUrl?: string;
}

export interface NormalizedLot {
  sourceLotCode: string;
  title?: string;
  cpvCodes: string[];
  executionProvinces: string[];
  baseBudgetExVatEur?: number;
  estimatedValueEur?: number;
}

/** One publication about the file (call for tenders, award, correction…). */
export interface NormalizedNotice {
  /** Stable per notice within the source record; used to avoid duplicate events. */
  externalNoticeId: string;
  eventType: string;
  headline: string;
  effectiveAt?: Date;
  payload: JsonObject;
}

export interface NormalizedTenderRecord {
  sourcePlatform: string;
  /** Stable id of the *file* (expediente) in the source, not of a single notice. */
  externalRecordId: string;
  officialUrl: string;
  sourceUpdatedAt: Date;
  rawPayload: unknown;

  authority?: NormalizedAuthority;
  expedienteNumber?: string;
  title: string;
  description?: string;
  contractType?: ContractType;
  procedureType?: string;
  status: TenderStatusValue;
  mainCpvCode?: string;
  cpvCodes: string[];
  executionProvinces: string[];
  executionScope: ExecutionScope;
  executionMunicipality?: string;
  /** Presupuesto base de licitación sin IVA. */
  baseBudgetExVatEur?: number;
  /** Valor estimado del contrato (incluye prórrogas y modificaciones previstas). */
  estimatedValueEur?: number;
  firstPublishedAt?: Date;
  submissionDeadlineAt?: Date;
  lots: NormalizedLot[];
  notices: NormalizedNotice[];
  /** Compact, source-specific extras shown on the detail page (documents, awards…). */
  summary: JsonObject;
}

export interface DeletedRecord {
  sourcePlatform: string;
  externalRecordId: string;
  deletedAt: Date;
  reason?: string;
}

export interface RecordError {
  externalRecordId?: string;
  message: string;
}

/** The document exactly as the source served it, kept for provenance. */
export interface RawDocument {
  body: string;
  contentType: string;
  /** File extension for archived copies, without the dot. */
  extension: string;
}

export interface SourcePage {
  url: string;
  raw?: RawDocument;
  records: NormalizedTenderRecord[];
  deletions: DeletedRecord[];
  errors: RecordError[];
  /** Oldest `updated` timestamp on the page; lets the pipeline stop incremental runs. */
  oldestUpdatedAt?: Date;
  newestUpdatedAt?: Date;
}

export interface FetchOptions {
  /** Stop after the page that reaches records older than this instant. */
  since?: Date;
  maxPages: number;
  startUrl?: string;
}

/** Object storage for raw source pages (S3-compatible in production). */
export interface RawArchive {
  put(object: { key: string; body: string; contentType: string }): Promise<void>;
}

export interface SourceConnector {
  readonly id: string;
  readonly label: string;
  readonly defaultUrl: string;
  pages(options: FetchOptions): AsyncIterable<SourcePage>;
}
