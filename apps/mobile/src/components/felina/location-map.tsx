/**
 * Native map (Apple Maps on iOS, Google Maps on Android), the counterpart of the web
 * app's Leaflet map. Two modes, combinable:
 *   * `markers`: points to show (colonies, cats); `onMarkerPress` opens them.
 *   * `picked` + `onPick`: a single location chosen by tapping or dragging the pin.
 */
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { MapPinOff } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Platform, Text as NativeText, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** Second line of the marker's callout. */
  description?: string;
  tone?: "brand" | "muted" | "positive";
  /** Shown inside the marker (e.g. a colony's cats); a plain dot without it. */
  count?: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Google Maps on Android needs an API key baked into the native build (app.config.ts).
 * Expo Go brings its own; a native build without one would crash on the first map.
 */
const MAPS_AVAILABLE =
  Platform.OS !== "android" ||
  isRunningInExpoGo() ||
  Constants.expoConfig?.extra?.androidGoogleMapsConfigured === true;

const SPAIN: Region = { latitude: 40.2, longitude: -3.7, latitudeDelta: 9, longitudeDelta: 9 };
const CLOSE = { latitudeDelta: 0.005, longitudeDelta: 0.005 };

const pinShadow = {
  borderColor: "#fff",
  shadowColor: "#1c1917",
  shadowOpacity: 0.45,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 3,
} as const;

function Pin({ color, count }: { color: string; count?: number }) {
  if (count === undefined) {
    return (
      <View
        style={{
          ...pinShadow,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: color,
          borderWidth: 3,
        }}
      />
    );
  }
  return (
    // Padding around the badge keeps the shadow inside the marker's snapshot.
    <View style={{ padding: 3 }}>
      <View
        style={{
          ...pinShadow,
          minWidth: 26,
          height: 26,
          paddingHorizontal: 6,
          borderRadius: 13,
          backgroundColor: color,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <NativeText
          style={{ color: "#fff", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] }}
        >
          {count > 999 ? "999+" : count}
        </NativeText>
      </View>
    </View>
  );
}

export function LocationMap({
  markers = [],
  picked = null,
  onPick,
  onMarkerPress,
  className,
  label = "Mapa",
}: {
  markers?: MapMarker[];
  picked?: LatLng | null;
  onPick?: (point: LatLng) => void;
  onMarkerPress?: (id: string) => void;
  className?: string;
  label?: string;
}) {
  const map = useRef<MapView>(null);
  const [brand, positive] = useCSSVariable(["--color-brand", "--color-positive"]).map(String);
  const colors = { brand, positive, muted: "#78716c" } as const;

  // Fit the markers (when nothing is picked) or follow the picked point.
  const markerKey = markers.map((m) => `${m.id}:${m.latitude}:${m.longitude}`).join("|");
  useEffect(() => {
    if (picked || markers.length === 0) return;
    const timer = setTimeout(() => {
      map.current?.fitToCoordinates(markers, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: false,
      });
    }, 50);
    return () => clearTimeout(timer);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- markerKey covers `markers`.
  }, [markerKey, picked]);
  useEffect(() => {
    if (picked) map.current?.animateToRegion({ ...picked, ...CLOSE }, 250);
  }, [picked?.latitude, picked?.longitude]); // oxlint-disable-line react-hooks/exhaustive-deps

  const frame = cn("h-72 overflow-hidden rounded-xl border border-border bg-muted", className);
  if (!MAPS_AVAILABLE) {
    return (
      <View
        accessibilityLabel={label}
        className={cn(frame, "items-center justify-center gap-2 p-6")}
      >
        <Icon icon={MapPinOff} color="muted-foreground" size={22} />
        <Text className="text-center text-sm text-muted-foreground">
          Mapa no disponible en esta compilación: falta GOOGLE_MAPS_ANDROID_API_KEY.
        </Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel={label} className={frame}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={picked ? { ...picked, ...CLOSE } : SPAIN}
        showsUserLocation={Boolean(onPick)}
        toolbarEnabled={false}
        onPress={
          onPick
            ? (e) => {
                if (e.nativeEvent.action === "marker-press") return;
                onPick(e.nativeEvent.coordinate);
              }
            : undefined
        }
      >
        {markers.map((m) => (
          <Marker
            // A new key re-renders the marker's image when its count changes.
            key={`${m.id}:${m.count}`}
            coordinate={m}
            title={m.label}
            description={m.description}
            tracksViewChanges={false}
            onCalloutPress={onMarkerPress ? () => onMarkerPress(m.id) : undefined}
          >
            <Pin color={colors[m.tone ?? "brand"]} count={m.count} />
          </Marker>
        ))}
        {picked ? (
          <Marker
            coordinate={picked}
            draggable={Boolean(onPick)}
            onDragEnd={(e) => onPick?.(e.nativeEvent.coordinate)}
            tracksViewChanges={false}
          >
            <Pin color={brand} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}
