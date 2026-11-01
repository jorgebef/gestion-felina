/**
 * PLACSP / CODICE code lists, transcribed from the official genericode files the feed
 * itself references (listURI attributes), e.g.
 *   https://contrataciondelestado.es/codice/cl/2.04/SyndicationContractFolderStatusCode-2.04.gc
 *   http://contrataciondelestado.es/codice/cl/2.08/ContractCode-2.08.gc
 *   https://contrataciondelestado.es/codice/cl/2.07/SyndicationTenderingProcessCode-2.07.gc
 *   http://contrataciondelestado.es/codice/cl/2.11/TenderingNoticeTypeCode-2.11.gc
 */
import type { ContractType, TenderStatusValue } from "@licita/domain/tenders";

/** SyndicationContractFolderStatusCode-2.04 */
export const FOLDER_STATUS: Record<string, TenderStatusValue> = {
  PRE: "planned", // Anuncio previo
  PUB: "open", // En plazo
  EV: "closed", // Pendiente de adjudicación
  ADJ: "awarded", // Adjudicada
  RES: "formalized", // Resuelta
  ANUL: "cancelled", // Anulada
};

/** ContractCode-2.08 */
export const CONTRACT_CODE: Record<string, { type: ContractType; label: string }> = {
  "1": { type: "supplies", label: "Suministros" },
  "2": { type: "services", label: "Servicios" },
  "3": { type: "works", label: "Obras" },
  "21": { type: "concession", label: "Gestión de Servicios Públicos" },
  "22": { type: "concession", label: "Concesión de Servicios" },
  "31": { type: "concession", label: "Concesión de Obras Públicas" },
  "32": { type: "concession", label: "Concesión de Obras" },
  "40": { type: "other", label: "Colaboración entre el sector público y sector privado" },
  "7": { type: "other", label: "Administrativo especial" },
  "8": { type: "other", label: "Privado" },
  "50": { type: "other", label: "Patrimonial" },
};

/** SyndicationTenderingProcessCode-2.07 → keys of PROCEDURE_LABELS. */
export const PROCEDURE_CODE: Record<string, string> = {
  "1": "open",
  "2": "restricted",
  "3": "negotiated_without_publicity",
  "4": "negotiated_with_publicity",
  "5": "competitive_dialogue",
  "6": "minor",
  "7": "framework_based",
  "8": "design_contest",
  "9": "simplified_open",
  "10": "innovation_partnership",
  "11": "innovation_based",
  "12": "dps_based",
  "13": "negotiation",
  "100": "internal_rules",
  "999": "other",
};

/** TenderingNoticeTypeCode-2.11 → event type + official label. */
export const NOTICE_TYPE: Record<string, { eventType: string; label: string }> = {
  DOC_PIN: { eventType: "prior_notice", label: "Anuncio Previo" },
  DOC_PIN_RTL: { eventType: "prior_notice", label: "Anuncio Previo con Reducción de Plazos" },
  DOC_CN: { eventType: "contract_notice", label: "Anuncio de Licitación" },
  DOC_CD: { eventType: "tender_documents", label: "Anuncio de Pliegos" },
  DOC_DD: { eventType: "descriptive_document", label: "Anuncio de Documento Descriptivo" },
  DOC_CAN_PROV: { eventType: "award", label: "Anuncio de Adjudicación Provisional" },
  DOC_CAN_DEF: { eventType: "award", label: "Anuncio de Adjudicación Definitiva" },
  DOC_CAN_ADJ: { eventType: "award", label: "Anuncio de Adjudicación" },
  DOC_FORM: { eventType: "formalization", label: "Anuncio de Formalización" },
  DOC_FORM_ENC: { eventType: "formalization", label: "Anuncio de Formalización de Encargo" },
  PRO_FORM_ENC: { eventType: "formalization", label: "Anuncio de Prórroga de Encargo" },
  DOC_MOD: { eventType: "modification", label: "Anuncio modificación de contrato" },
  DOC_CCN: { eventType: "completion", label: "Anuncio de Finalización de Contrato" },
  DOC_CON: { eventType: "market_consultation", label: "Anuncio de Consulta Preliminar de Mercado" },
  RENUNCIA: { eventType: "withdrawal", label: "Anuncio de Renuncia" },
  DESISTIMIENTO: { eventType: "withdrawal", label: "Anuncio de Desistimiento" },
};

export function noticeType(code: string): { eventType: string; label: string } {
  if (NOTICE_TYPE[code]) return NOTICE_TYPE[code];
  if (code.startsWith("ANUL_")) return { eventType: "cancellation", label: `Anulación (${code})` };
  return { eventType: "notice", label: code };
}

/** TenderResultCode-2.09 */
export const RESULT_CODE: Record<string, string> = {
  "1": "Adjudicado provisionalmente",
  "2": "Adjudicado definitivamente",
  "3": "Desierto",
  "4": "Desistimiento",
  "5": "Renuncia",
  "6": "Desierto provisionalmente",
  "7": "Desierto definitivamente",
  "8": "Adjudicado",
  "9": "Formalizado",
  "10": "Licitador mejor valorado",
  "11": "Encargo formalizado",
};

/** ContractingAuthorityCode-2.10 */
export const AUTHORITY_TYPE: Record<string, string> = {
  "1": "Autoridad estatal",
  "2": "Autoridad regional",
  "3": "Autoridad local",
  "4": "Organismo de Derecho público",
  "5": "Otras Entidades del Sector Público",
  "6": "Organismo de Derecho público bajo el control de una autoridad estatal",
  "7": "Organismo de Derecho público bajo el control de una autoridad regional",
  "8": "Organismo de Derecho público bajo el control de una autoridad local",
  "9": "Empresa pública bajo el control de una autoridad estatal",
  "10": "Empresa pública bajo el control de una autoridad regional",
  "11": "Empresa pública bajo el control de una autoridad local",
  "12": "Entidad con derechos especiales o exclusivos",
};
