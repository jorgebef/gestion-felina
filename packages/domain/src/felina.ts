/**
 * Closed vocabularies of the platform. The database stores the codes (English, stable);
 * the UI shows the Spanish labels.
 */

export const ORGANIZATION_KINDS = ["association", "town_hall"] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];
export const ORGANIZATION_KIND_LABELS: Record<OrganizationKind, string> = {
  association: "Asociación",
  town_hall: "Ayuntamiento",
};

export const ORGANIZATION_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  pending: "Pendiente de aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
  suspended: "Suspendida",
};

export const MEMBER_ROLES = ["admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Administrador/a",
  member: "Miembro",
};

export const CAT_SEXES = ["female", "male", "unknown"] as const;
export type CatSex = (typeof CAT_SEXES)[number];
export const CAT_SEX_LABELS: Record<CatSex, string> = {
  female: "Hembra",
  male: "Macho",
  unknown: "Desconocido",
};

export const ACTION_TYPES = [
  "sterilization",
  "vet_visit",
  "capture",
  "release",
  "feeding",
  "other",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  sterilization: "Castración",
  vet_visit: "Veterinario",
  capture: "Captura",
  release: "Suelta",
  feeding: "Alimentación",
  other: "Otro",
};

export const ACTION_STATUSES = ["planned", "in_progress", "done", "cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  planned: "Planificada",
  in_progress: "En proceso",
  done: "Realizada",
  cancelled: "Cancelada",
};

export const PROPOSAL_TARGETS = ["colony", "cat"] as const;
export type ProposalTarget = (typeof PROPOSAL_TARGETS)[number];

export const PROPOSAL_STATUSES = ["pending", "accepted", "rejected", "withdrawn"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  withdrawn: "Retirada",
};

/** Fields a town hall may propose to change, with their labels. */
export const COLONY_PROPOSABLE_FIELDS = {
  name: "Nombre",
  description: "Descripción",
  address: "Dirección",
  latitude: "Latitud",
  longitude: "Longitud",
  municipalityCode: "Municipio",
} as const;
export type ColonyProposableField = keyof typeof COLONY_PROPOSABLE_FIELDS;

export const CAT_PROPOSABLE_FIELDS = {
  name: "Nombre",
  sex: "Sexo",
  birthDate: "Fecha de nacimiento",
  birthDateApproximate: "Fecha aproximada",
  sterilized: "Castrado",
  description: "Descripción",
  address: "Dirección",
  latitude: "Latitud",
  longitude: "Longitud",
  municipalityCode: "Municipio",
} as const;
export type CatProposableField = keyof typeof CAT_PROPOSABLE_FIELDS;

/** Rough bounding box of Spain, Canarias included (also enforced by the database). */
export const SPAIN_BOUNDS = { minLat: 27, maxLat: 44.5, minLng: -18.5, maxLng: 4.6 } as const;

export function isInSpain(latitude: number, longitude: number): boolean {
  return (
    latitude >= SPAIN_BOUNDS.minLat &&
    latitude <= SPAIN_BOUNDS.maxLat &&
    longitude >= SPAIN_BOUNDS.minLng &&
    longitude <= SPAIN_BOUNDS.maxLng
  );
}

/** Display name of a cat that may not have one. */
export function catDisplayName(cat: { name: string | null }): string {
  return cat.name?.trim() || "Gato sin nombre";
}
