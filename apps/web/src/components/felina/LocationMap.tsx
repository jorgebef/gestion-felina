/**
 * OpenStreetMap map (Leaflet), rendered only in the browser. Two modes, combinable:
 *   * `markers`: points to show (colonies, cats); `onMarkerClick` opens them.
 *   * `picked` + `onPick`: a single location chosen by clicking or dragging the pin.
 */
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  tone?: "brand" | "muted" | "positive";
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

const SPAIN_CENTER: [number, number] = [40.2, -3.7];

function pinIcon(L: typeof Leaflet, tone: MapMarker["tone"] = "brand") {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" data-tone="${tone}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export function LocationMap({
  markers = [],
  picked = null,
  onPick,
  onMarkerClick,
  className,
  label = "Mapa",
}: {
  markers?: MapMarker[];
  picked?: LatLng | null;
  onPick?: (point: LatLng) => void;
  onMarkerClick?: (id: string) => void;
  className?: string;
  label?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef<{
    L: typeof Leaflet;
    map: Leaflet.Map;
    layer: Leaflet.LayerGroup;
    pin: Leaflet.Marker | null;
  } | null>(null);
  const [ready, setReady] = useState(false);
  // Latest callbacks, so the map isn't rebuilt when they change.
  const callbacks = useRef({ onPick, onMarkerClick });
  callbacks.current = { onPick, onMarkerClick };

  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | undefined;
    void import("leaflet").then((module) => {
      const L = (module as unknown as { default?: typeof Leaflet }).default ?? module;
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false }).setView(SPAIN_CENTER, 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        callbacks.current.onPick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      state.current = { L, map, layer: L.layerGroup().addTo(map), pin: null };
      setReady(true);
    });
    return () => {
      cancelled = true;
      map?.remove();
      state.current = null;
    };
  }, []);

  // Markers.
  const markerKey = markers.map((m) => `${m.id}:${m.latitude}:${m.longitude}:${m.tone}`).join("|");
  useEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    s.layer.clearLayers();
    for (const m of markers) {
      s.L.marker([m.latitude, m.longitude], { icon: pinIcon(s.L, m.tone), title: m.label })
        .bindTooltip(m.label)
        .on("click", () => callbacks.current.onMarkerClick?.(m.id))
        .addTo(s.layer);
    }
    if (markers.length && !picked) {
      const bounds = s.L.latLngBounds(markers.map((m) => [m.latitude, m.longitude]));
      s.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- markerKey covers `markers`.
  }, [ready, markerKey]);

  // Picked location.
  useEffect(() => {
    const s = state.current;
    if (!ready || !s) return;
    if (!picked) {
      s.pin?.remove();
      s.pin = null;
      return;
    }
    const position: [number, number] = [picked.latitude, picked.longitude];
    if (!s.pin) {
      s.pin = s.L.marker(position, { icon: pinIcon(s.L), draggable: Boolean(onPick) }).addTo(s.map);
      s.pin.on("dragend", () => {
        const point = s.pin!.getLatLng();
        callbacks.current.onPick?.({ latitude: point.lat, longitude: point.lng });
      });
      s.map.setView(position, Math.max(s.map.getZoom(), 16));
    } else {
      s.pin.setLatLng(position);
      if (!s.map.getBounds().contains(position)) s.map.panTo(position);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only the coordinates matter.
  }, [ready, picked?.latitude, picked?.longitude]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className={cn("z-0 h-72 w-full overflow-hidden rounded-xl border bg-muted", className)}
    />
  );
}
