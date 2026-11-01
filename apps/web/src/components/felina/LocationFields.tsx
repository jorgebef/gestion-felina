import { Crosshair, Loader2 } from "lucide-react";
import { useState } from "react";

import { isInSpain } from "@felina/domain/felina";

import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { LocationMap, type MapMarker } from "./LocationMap";
import { MunicipalityPicker, type MunicipalityValue } from "./MunicipalityPicker";

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

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Exact location (pin on the map, or the device's position), the INE municipality and an
 * optional street address.
 */
export function LocationFields({
  value,
  onChange,
  errors = {},
  disabled,
  context = [],
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  errors?: { coordinates?: string; municipality?: string; address?: string };
  disabled?: boolean;
  /** Other points shown for reference (e.g. the colony of a cat). */
  context?: MapMarker[];
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const picked =
    value.latitude !== null && value.longitude !== null
      ? { latitude: value.latitude, longitude: value.longitude }
      : null;

  const setPoint = (latitude: number, longitude: number) =>
    onChange({ ...value, latitude: round(latitude), longitude: round(longitude) });

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Tu navegador no permite obtener la ubicación.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        if (!isInSpain(position.coords.latitude, position.coords.longitude)) {
          setGeoError("Tu ubicación actual no está en España.");
          return;
        }
        setPoint(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocating(false);
        setGeoError("No hemos podido obtener tu ubicación. Marca el punto en el mapa.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const coordinateInput = (key: "latitude" | "longitude", label: string) => (
    <Field id={key} label={label}>
      <Input
        id={key}
        type="number"
        inputMode="decimal"
        step="0.000001"
        disabled={disabled}
        value={value[key] ?? ""}
        onChange={(e) => {
          const n = e.target.value === "" ? null : Number(e.target.value);
          onChange({ ...value, [key]: n !== null && Number.isFinite(n) ? n : null });
        }}
        className="tabular bg-card"
      />
    </Field>
  );

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="sr-only">Ubicación</legend>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Ubicación exacta</p>
          <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
            Usar mi ubicación
          </Button>
        </div>
        <LocationMap
          label="Mapa para elegir la ubicación"
          picked={picked}
          markers={context}
          onPick={disabled ? undefined : (p) => setPoint(p.latitude, p.longitude)}
          className={errors.coordinates ? "border-negative" : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Haz clic en el mapa o arrastra el punto. La ubicación solo la ven tu organización y el
          ayuntamiento del municipio.
        </p>
        {errors.coordinates ? <p className="text-xs text-negative">{errors.coordinates}</p> : null}
        {geoError ? <p className="text-xs text-warning">{geoError}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {coordinateInput("latitude", "Latitud")}
        {coordinateInput("longitude", "Longitud")}
      </div>
      <Field id="municipality" label="Municipio" error={errors.municipality}>
        <MunicipalityPicker
          id="municipality"
          value={value.municipality}
          onChange={(municipality) => onChange({ ...value, municipality })}
          disabled={disabled}
          invalid={Boolean(errors.municipality)}
        />
      </Field>
      <Field id="address" label="Dirección" optional error={errors.address}>
        <Input
          id="address"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Calle, número, referencia…"
          className="bg-card"
        />
      </Field>
    </fieldset>
  );
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
