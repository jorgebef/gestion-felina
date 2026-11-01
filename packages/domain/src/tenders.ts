/** Labels and value sets for normalized tender fields (shared by server and UI). */

export const CONTRACT_TYPES = ["works", "services", "supplies", "concession", "other"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  works: "Obras",
  services: "Servicios",
  supplies: "Suministros",
  concession: "Concesiones",
  other: "Otros",
};

export const CONTRACT_TYPE_HINTS: Record<ContractType, string> = {
  works: "Construcción, reformas, urbanización, instalaciones en edificios…",
  services: "Limpieza, mantenimiento, consultoría, informática, formación…",
  supplies: "Compra o alquiler de productos: material, equipos, vehículos…",
  concession: "Gestión de un servicio u obra a cambio de su explotación.",
  other: "Contratos administrativos especiales, privados o patrimoniales.",
};

export const TENDER_STATUSES = [
  "planned",
  "open",
  "closed",
  "awarded",
  "formalized",
  "cancelled",
  "suspended",
  "unknown",
] as const;
export type TenderStatusValue = (typeof TENDER_STATUSES)[number];

export const TENDER_STATUS_LABELS: Record<TenderStatusValue, string> = {
  planned: "Anuncio previo",
  open: "En plazo",
  closed: "Pendiente de adjudicación",
  awarded: "Adjudicada",
  formalized: "Resuelta",
  cancelled: "Anulada",
  suspended: "Suspendida",
  unknown: "Sin estado",
};

/** Statuses in which a company can still prepare an offer (or soon will). */
export const ACTIONABLE_STATUSES: readonly TenderStatusValue[] = ["planned", "open"];

export const PROCEDURE_LABELS: Record<string, string> = {
  open: "Abierto",
  restricted: "Restringido",
  negotiated_without_publicity: "Negociado sin publicidad",
  negotiated_with_publicity: "Negociado con publicidad",
  competitive_dialogue: "Diálogo competitivo",
  minor: "Contrato menor",
  framework_based: "Derivado de acuerdo marco",
  design_contest: "Concurso de proyectos",
  simplified_open: "Abierto simplificado",
  innovation_partnership: "Asociación para la innovación",
  innovation_based: "Derivado de asociación para la innovación",
  dps_based: "Basado en un sistema dinámico de adquisición",
  negotiation: "Licitación con negociación",
  internal_rules: "Normas internas",
  other: "Otros",
};

export const WORKFLOW_STATUSES = [
  "saved",
  "evaluating",
  "preparing",
  "submitted",
  "won",
  "lost",
  "archived",
] as const;
export type WorkflowStatusValue = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_LABELS: Record<WorkflowStatusValue, string> = {
  saved: "Guardada",
  evaluating: "Evaluando",
  preparing: "Preparando oferta",
  submitted: "Oferta presentada",
  won: "Ganada",
  lost: "Perdida",
  archived: "Archivada",
};

export const EMAIL_FREQUENCIES = ["daily", "weekly", "instant", "off"] as const;
export type EmailFrequencyValue = (typeof EMAIL_FREQUENCIES)[number];

export const EMAIL_FREQUENCY_LABELS: Record<EmailFrequencyValue, string> = {
  daily: "Resumen diario",
  weekly: "Resumen semanal",
  instant: "En cuanto aparezcan",
  off: "Sin correos (solo en la app)",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  prior_notice: "Anuncio previo",
  contract_notice: "Anuncio de licitación",
  tender_documents: "Publicación de pliegos",
  descriptive_document: "Documento descriptivo",
  award: "Adjudicación",
  formalization: "Formalización",
  modification: "Modificación de contrato",
  cancellation: "Anulación de anuncio",
  withdrawal: "Renuncia o desistimiento",
  completion: "Finalización de contrato",
  market_consultation: "Consulta preliminar de mercado",
  status_change: "Cambio de estado",
  change_detected: "Cambios en los datos",
  removed_from_source: "Retirada de la fuente oficial",
  notice: "Anuncio",
};

export const SOURCE_PLATFORM_LABELS: Record<string, string> = {
  placsp_direct: "Plataforma de Contratación del Sector Público",
};

/** Source-specific extras stored in `tenders.raw_summary` and shown on the detail page. */
export interface TenderSummary {
  statusCode?: string;
  procedureCode?: string;
  totalAmountWithVatEur?: number;
  durationText?: string;
  deadlineNote?: string;
  contractTypeLabel?: string;
  executionScope?: string;
  documents?: { kind: string; name: string; url: string }[];
  results?: {
    lot?: string;
    result?: string;
    awardDate?: string;
    winner?: string;
    amountExVatEur?: number;
    receivedTenders?: string;
  }[];
}

export interface FieldChange {
  label: string;
  from: string | null;
  to: string | null;
}

/** Payloads the import pipeline writes to `tender_events.payload`, by event type. */
export interface TenderEventPayload {
  /** Official notices. */
  noticeTypeCode?: string;
  media?: string;
  issueDate?: string;
  /** status_change */
  from?: string | null;
  to?: string | null;
  /** change_detected */
  changes?: Record<string, FieldChange>;
  /** removed_from_source */
  reason?: string | null;
}
