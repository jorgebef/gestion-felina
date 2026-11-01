/**
 * Parser for the PLACSP syndication feeds (ATOM + CODICE `ContractFolderStatus`).
 *
 * Each ATOM <entry> is the *current snapshot* of one contract file (expediente):
 * the same entry id is republished with a newer <updated> whenever a notice is added
 * or the status changes. Individual notices are listed inside it as ValidNoticeInfo
 * elements, which become tender_events. <at:deleted-entry> tombstones signal records
 * removed from the platform.
 *
 * Feed documentation: "Sindicación de licitaciones" in
 * https://contrataciondelsectorpublico.gob.es/ (Datos abiertos).
 */
import { XMLParser } from "fast-xml-parser";

import {
  provinceFromPostalCode,
  provincesForNuts,
  type ExecutionScope,
} from "@licita/domain/provinces";

import { madridLocalToDate, parseInstant } from "../time.ts";
import type {
  DeletedRecord,
  NormalizedAuthority,
  NormalizedLot,
  NormalizedNotice,
  NormalizedTenderRecord,
  RecordError,
} from "../types.ts";
import {
  AUTHORITY_TYPE,
  CONTRACT_CODE,
  FOLDER_STATUS,
  PROCEDURE_CODE,
  RESULT_CODE,
  noticeType,
} from "./codes.ts";

export const PLACSP_PLATFORM = "placsp_direct";

const ARRAY_TAGS = new Set([
  "entry",
  "link",
  "deleted-entry",
  "ProcurementProjectLot",
  "RequiredCommodityClassification",
  "PartyIdentification",
  "ValidNoticeInfo",
  "AdditionalPublicationStatus",
  "AdditionalPublicationDocumentReference",
  "TenderResult",
  "LegalDocumentReference",
  "TechnicalDocumentReference",
  "AdditionalDocumentReference",
  "RealizedLocation",
]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

// ----------------------------------------------------------------------------
// Small helpers over the parsed tree (nodes are strings or objects with "#text").

type Node = Record<string, unknown>;

function obj(value: unknown): Node | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Node) : undefined;
}

function list(value: unknown): Node[] {
  if (Array.isArray(value)) return value.map(obj).filter((v): v is Node => Boolean(v));
  const single = obj(value);
  return single ? [single] : [];
}

function text(value: unknown): string | undefined {
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  const node = obj(value);
  return node ? text(node["#text"]) : undefined;
}

function attr(value: unknown, name: string): string | undefined {
  const node = obj(Array.isArray(value) ? value[0] : value);
  const raw = node?.[`@_${name}`];
  return typeof raw === "string" ? raw : undefined;
}

function amount(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : undefined;
}

function at(node: Node | undefined, ...path: string[]): unknown {
  let current: unknown = node;
  for (const key of path) {
    const o = obj(Array.isArray(current) ? current[0] : current);
    if (!o) return undefined;
    current = o[key];
  }
  return current;
}

function cpvList(project: Node | undefined): string[] {
  return list(project?.RequiredCommodityClassification)
    .map((c) => text(c.ItemClassificationCode))
    .filter((c): c is string => Boolean(c && /^\d{8}$/.test(c)));
}

function locations(project: Node | undefined): {
  provinces: string[];
  scope: ExecutionScope;
  municipality?: string;
} {
  const provinces = new Set<string>();
  let scope: ExecutionScope = "unknown";
  let municipality: string | undefined;
  const rank: Record<ExecutionScope, number> = {
    unknown: 0,
    provincial: 1,
    regional: 2,
    national: 3,
  };
  for (const location of list(project?.RealizedLocation)) {
    const code = text(location.CountrySubentityCode);
    if (code) {
      const resolved = provincesForNuts(code);
      resolved.provinces.forEach((p) => provinces.add(p));
      if (rank[resolved.scope] > rank[scope]) scope = resolved.scope;
    }
    municipality ??= text(at(location, "Address", "CityName"));
  }
  return { provinces: [...provinces].sort(), scope, municipality };
}

// ----------------------------------------------------------------------------

function parseAuthority(folder: Node): NormalizedAuthority | undefined {
  const located = obj(folder.LocatedContractingParty);
  const party = obj(located?.Party);
  const name = text(at(party, "PartyName", "Name"));
  if (!located || !party || !name) return undefined;

  const ids = new Map<string, string>();
  for (const identification of list(party.PartyIdentification)) {
    const scheme = attr(identification.ID, "schemeName");
    const value = text(identification.ID);
    if (scheme && value) ids.set(scheme, value);
  }
  const address = obj(party.PostalAddress);
  const typeCode = text(located.ContractingPartyTypeCode);
  return {
    name: name.replace(/\s+/g, " "),
    platformId: ids.get("ID_PLATAFORMA"),
    taxId: ids.get("NIF"),
    dir3: ids.get("DIR3"),
    administrationType: typeCode ? (AUTHORITY_TYPE[typeCode] ?? `Código ${typeCode}`) : undefined,
    provinceCode: provinceFromPostalCode(text(address?.PostalZone)),
    municipality: text(address?.CityName),
    profileUrl: text(located.BuyerProfileURIID),
  };
}

function parseLots(folder: Node): NormalizedLot[] {
  return list(folder.ProcurementProjectLot).flatMap((lot) => {
    const code = text(lot.ID);
    if (!code) return [];
    const project = obj(lot.ProcurementProject);
    const budget = obj(project?.BudgetAmount);
    return [
      {
        sourceLotCode: code,
        title: text(project?.Name),
        cpvCodes: cpvList(project),
        executionProvinces: locations(project).provinces,
        baseBudgetExVatEur: amount(budget?.TaxExclusiveAmount),
        estimatedValueEur: amount(budget?.EstimatedOverallContractAmount),
      },
    ];
  });
}

function parseNotices(folder: Node): NormalizedNotice[] {
  const notices = new Map<string, NormalizedNotice>();
  for (const info of list(folder.ValidNoticeInfo)) {
    const code = text(info.NoticeTypeCode);
    if (!code) continue;
    const type = noticeType(code);
    for (const status of list(info.AdditionalPublicationStatus)) {
      const media = text(status.PublicationMediaName) ?? "Sin medio";
      for (const ref of list(status.AdditionalPublicationDocumentReference)) {
        const issueDate = text(ref.IssueDate)?.slice(0, 10);
        if (!issueDate) continue; // document-only references carry no publication date
        const externalNoticeId = `${code}|${media}|${issueDate}`;
        if (notices.has(externalNoticeId)) continue;
        notices.set(externalNoticeId, {
          externalNoticeId,
          eventType: type.eventType,
          headline: type.label,
          effectiveAt: madridLocalToDate(issueDate),
          payload: { noticeTypeCode: code, media, issueDate },
        });
      }
    }
  }
  return [...notices.values()].sort(
    (a, b) => (a.effectiveAt?.getTime() ?? 0) - (b.effectiveAt?.getTime() ?? 0),
  );
}

function firstPublication(notices: NormalizedNotice[]): Date | undefined {
  const calls = notices.filter((n) => n.eventType === "contract_notice");
  const pool = calls.length
    ? calls
    : notices.filter((n) => n.eventType === "prior_notice").length
      ? notices.filter((n) => n.eventType === "prior_notice")
      : notices;
  return pool.find((n) => n.effectiveAt)?.effectiveAt;
}

function parseDocuments(folder: Node) {
  const kinds = [
    ["LegalDocumentReference", "Pliego de cláusulas administrativas"],
    ["TechnicalDocumentReference", "Pliego de prescripciones técnicas"],
    ["AdditionalDocumentReference", "Documento adicional"],
  ] as const;
  return kinds.flatMap(([tag, kind]) =>
    list(folder[tag]).flatMap((doc) => {
      const url = text(at(doc, "Attachment", "ExternalReference", "URI"));
      const name = text(doc.ID);
      return url ? [{ kind, name: name ?? kind, url }] : [];
    }),
  );
}

function parseResults(folder: Node) {
  return list(folder.TenderResult).map((result) => {
    const resultCode = text(result.ResultCode);
    return {
      lot: text(at(result, "AwardedTenderedProject", "ProcurementProjectLotID")),
      result: resultCode ? (RESULT_CODE[resultCode] ?? resultCode) : undefined,
      awardDate: text(result.AwardDate),
      receivedTenders: text(result.ReceivedTenderQuantity),
      winner: text(at(result, "WinningParty", "PartyName", "Name")),
      amountExVatEur: amount(
        at(result, "AwardedTenderedProject", "LegalMonetaryTotal", "TaxExclusiveAmount"),
      ),
    };
  });
}

/** Entry ids look like https://…/licitacionesPerfilContratante/20757267. */
export function externalIdFromEntryId(entryId: string): string {
  return /\/(\d+)\s*$/.exec(entryId)?.[1] ?? entryId.trim();
}

export function parseEntry(entry: Node): NormalizedTenderRecord {
  const entryId = text(entry.id);
  if (!entryId) throw new Error("Entry without <id>");
  const externalRecordId = externalIdFromEntryId(entryId);
  const folder = obj(entry.ContractFolderStatus);
  if (!folder) throw new Error("Entry without ContractFolderStatus");
  const updated = parseInstant(text(entry.updated));
  if (!updated) throw new Error("Entry without a valid <updated>");

  const project = obj(folder.ProcurementProject);
  const budget = obj(project?.BudgetAmount);
  const process = obj(folder.TenderingProcess);
  const deadline = obj(process?.TenderSubmissionDeadlinePeriod);
  const statusCode = text(folder.ContractFolderStatusCode);
  const typeCode = text(project?.TypeCode);
  const procedureCode = text(process?.ProcedureCode);

  const lots = parseLots(folder);
  const projectCpvs = cpvList(project);
  const cpvCodes = [...new Set([...projectCpvs, ...lots.flatMap((l) => l.cpvCodes)])];
  const place = locations(project);
  const lotProvinces = lots.flatMap((l) => l.executionProvinces);
  const executionProvinces = [...new Set([...place.provinces, ...lotProvinces])].sort();
  const notices = parseNotices(folder);
  const officialUrl =
    list(entry.link)
      .map((l) => attr(l, "href"))
      .find(Boolean) ?? entryId;
  const title = (text(entry.title) ?? text(project?.Name) ?? "").replace(/\s+/g, " ");
  if (!title) throw new Error("Entry without title");

  const endDate = text(deadline?.EndDate);

  return {
    sourcePlatform: PLACSP_PLATFORM,
    externalRecordId,
    officialUrl,
    sourceUpdatedAt: updated,
    rawPayload: entry,
    authority: parseAuthority(folder),
    expedienteNumber: text(folder.ContractFolderID),
    title,
    description: text(project?.Description),
    contractType: typeCode ? CONTRACT_CODE[typeCode]?.type : undefined,
    procedureType: procedureCode ? (PROCEDURE_CODE[procedureCode] ?? "other") : undefined,
    status: (statusCode && FOLDER_STATUS[statusCode]) || "unknown",
    mainCpvCode: projectCpvs[0] ?? cpvCodes[0],
    cpvCodes,
    executionProvinces,
    executionScope:
      executionProvinces.length && place.scope === "unknown" ? "provincial" : place.scope,
    executionMunicipality: place.municipality,
    baseBudgetExVatEur: amount(budget?.TaxExclusiveAmount),
    estimatedValueEur: amount(budget?.EstimatedOverallContractAmount),
    firstPublishedAt: firstPublication(notices),
    submissionDeadlineAt: endDate ? madridLocalToDate(endDate, text(deadline?.EndTime)) : undefined,
    lots,
    notices,
    summary: {
      source: PLACSP_PLATFORM,
      statusCode,
      contractTypeCode: typeCode,
      contractTypeLabel: typeCode ? CONTRACT_CODE[typeCode]?.label : undefined,
      procedureCode,
      executionScope: place.scope,
      totalAmountWithVatEur: amount(budget?.TotalAmount),
      durationText: durationText(project),
      deadlineNote: text(deadline?.Description),
      documents: parseDocuments(folder),
      results: parseResults(folder),
      authorityDir3: parseAuthority(folder)?.dir3,
    },
  };
}

function durationText(project: Node | undefined): string | undefined {
  const measure = at(project, "PlannedPeriod", "DurationMeasure");
  const value = text(measure);
  const unit = attr(measure, "unitCode");
  if (!value) return undefined;
  const units: Record<string, [string, string]> = {
    DAY: ["día", "días"],
    MON: ["mes", "meses"],
    ANN: ["año", "años"],
  };
  const [one, many] = units[unit ?? ""] ?? ["", ""];
  return `${value} ${value === "1" ? one : many}`.trim();
}

export interface ParsedFeed {
  records: NormalizedTenderRecord[];
  deletions: DeletedRecord[];
  errors: RecordError[];
  nextUrl?: string;
  oldestUpdatedAt?: Date;
  newestUpdatedAt?: Date;
}

/** Parses one feed document. A malformed entry is reported, never fatal. */
export function parseFeed(document: string): ParsedFeed {
  const root = obj(xml.parse(document))?.feed;
  const feed = obj(root);
  if (!feed) throw new Error("Not an ATOM feed: <feed> element not found");

  const records: NormalizedTenderRecord[] = [];
  const errors: RecordError[] = [];
  const updatedTimes: number[] = [];
  for (const entry of list(feed.entry)) {
    const entryId = text(entry.id);
    const updated = parseInstant(text(entry.updated));
    if (updated) updatedTimes.push(updated.getTime());
    try {
      records.push(parseEntry(entry));
    } catch (error) {
      errors.push({
        externalRecordId: entryId ? externalIdFromEntryId(entryId) : undefined,
        message: (error as Error).message,
      });
    }
  }

  const deletions: DeletedRecord[] = list(feed["deleted-entry"]).flatMap((tombstone) => {
    const ref = attr(tombstone, "ref");
    const when = parseInstant(attr(tombstone, "when"));
    if (!ref || !when) return [];
    updatedTimes.push(when.getTime());
    return [
      {
        sourcePlatform: PLACSP_PLATFORM,
        externalRecordId: externalIdFromEntryId(ref),
        deletedAt: when,
        reason: attr(tombstone.comment, "type"),
      },
    ];
  });

  const nextUrl = list(feed.link).find((l) => attr(l, "rel") === "next");
  return {
    records,
    deletions,
    errors,
    nextUrl: nextUrl ? attr(nextUrl, "href") : undefined,
    oldestUpdatedAt: updatedTimes.length ? new Date(Math.min(...updatedTimes)) : undefined,
    newestUpdatedAt: updatedTimes.length ? new Date(Math.max(...updatedTimes)) : undefined,
  };
}
