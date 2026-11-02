import * as Location from "expo-location";
import { Crosshair } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { isInSpain } from "@felina/domain/felina";
import { roundCoordinate, type LocationValue } from "@felina/client/location";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { LocationMap, type MapMarker } from "./location-map";
import { MunicipalityPicker } from "./municipality-picker";

export { emptyLocation, locationPayload, type LocationValue } from "@felina/client/location";

function coordinateText(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

function parseCoordinate(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Exact location (pin on the map, or the device's position), the INE municipality and an
 * optional street address. Same fields and validation as the web form.
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
  // Typed text of each coordinate, so "40," can be typed on the way to "40,4".
  const [typed, setTyped] = useState<{ latitude?: string; longitude?: string }>({});
  const picked =
    value.latitude !== null && value.longitude !== null
      ? { latitude: value.latitude, longitude: value.longitude }
      : null;

  const setPoint = (latitude: number, longitude: number) => {
    setTyped({});
    onChange({
      ...value,
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    });
  };

  const locate = async () => {
    setGeoError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setGeoError("Sin permiso de ubicación. Marca el punto en el mapa.");
      return;
    }
    setLocating(true);
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!isInSpain(position.coords.latitude, position.coords.longitude)) {
        setGeoError("Tu ubicación actual no está en España.");
        return;
      }
      setPoint(position.coords.latitude, position.coords.longitude);
    } catch {
      setGeoError("No hemos podido obtener tu ubicación. Marca el punto en el mapa.");
    } finally {
      setLocating(false);
    }
  };

  const coordinateInput = (key: "latitude" | "longitude", label: string) => (
    <Field label={label} className="flex-1">
      <Input
        keyboardType="numbers-and-punctuation"
        editable={!disabled}
        value={typed[key] ?? coordinateText(value[key])}
        onChangeText={(text) => {
          setTyped((t) => ({ ...t, [key]: text }));
          onChange({ ...value, [key]: parseCoordinate(text) });
        }}
        accessibilityLabel={label}
        className="font-mono"
      />
    </Field>
  );

  return (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-sm font-medium text-foreground">Ubicación exacta</Text>
          <Button
            variant="outline"
            size="sm"
            icon={Crosshair}
            loading={locating}
            disabled={disabled}
            onPress={() => void locate()}
          >
            Usar mi ubicación
          </Button>
        </View>
        <LocationMap
          label="Mapa para elegir la ubicación"
          picked={picked}
          markers={context}
          onPick={disabled ? undefined : (p) => setPoint(p.latitude, p.longitude)}
          className={errors.coordinates ? "border-negative" : undefined}
        />
        <Text className="text-xs text-muted-foreground">
          Toca el mapa o arrastra el punto. La ubicación solo la ven tu organización y el
          ayuntamiento del municipio.
        </Text>
        {errors.coordinates ? (
          <Text className="text-xs text-negative">{errors.coordinates}</Text>
        ) : null}
        {geoError ? <Text className="text-xs text-warning">{geoError}</Text> : null}
      </View>
      <View className="flex-row gap-3">
        {coordinateInput("latitude", "Latitud")}
        {coordinateInput("longitude", "Longitud")}
      </View>
      <Field label="Municipio" error={errors.municipality}>
        <MunicipalityPicker
          value={value.municipality}
          onChange={(municipality) => onChange({ ...value, municipality })}
          disabled={disabled}
          invalid={Boolean(errors.municipality)}
        />
      </Field>
      <Field label="Dirección" optional error={errors.address}>
        <Input
          value={value.address}
          editable={!disabled}
          onChangeText={(address) => onChange({ ...value, address })}
          placeholder="Calle, número, referencia…"
          accessibilityLabel="Dirección"
        />
      </Field>
    </View>
  );
}
