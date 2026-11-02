/**
 * Location of a colony or cat as edited in a form (exact point, INE municipality and
 * optional address), and its conversion to what the API expects. Shared by the web and
 * mobile location fields.
 */
import { isInSpain } from "@felina/domain/felina";

/** A municipality chosen in a picker. */
export interface MunicipalityValue {
  code: string;
  name: string;
  provinceName?: string;
}

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  municipality: MunicipalityValue | null;
  address: string;
}

export const emptyLocation: LocationValue = {
  latitude: null,
  longitude: null,
  municipality: null,
  address: "",
};

/** Coordinates are stored with 6 decimals (~10 cm). */
export function roundCoordinate(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

/** Location fields as the API expects them, or the per-field errors. */
export function locationPayload(value: LocationValue):
  | {
      ok: true;
      data: {
        latitude: number;
        longitude: number;
        municipalityCode: string;
        address: string | null;
      };
    }
  | { ok: false; errors: { coordinates?: string; municipality?: string } } {
  const errors: { coordinates?: string; municipality?: string } = {};
  if (value.latitude === null || value.longitude === null) {
    errors.coordinates = "Marca la ubicación en el mapa";
  } else if (!isInSpain(value.latitude, value.longitude)) {
    errors.coordinates = "La ubicación debe estar en España";
  }
  if (!value.municipality) errors.municipality = "Elige el municipio";
  if (errors.coordinates || errors.municipality) return { ok: false, errors };
  return {
    ok: true,
    data: {
      latitude: value.latitude!,
      longitude: value.longitude!,
      municipalityCode: value.municipality!.code,
      address: value.address.trim() || null,
    },
  };
}
