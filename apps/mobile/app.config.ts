import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic part of the app config; the static part lives in app.json (passed in as
 * `config`). Values come from the environment or apps/mobile/.env.local, which Expo
 * loads before evaluating this file, so they also reach `expo prebuild`/`expo run:*`.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY: Google Maps SDK for Android key. Expo Go ships its own,
 * but a native build crashes on the first map without one, so the map is replaced by
 * a notice when it is missing (see src/components/felina/location-map.tsx). iOS uses
 * Apple Maps and needs no key. Changing it requires rebuilding the native app.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined;

  return {
    ...config,
    name: config.name ?? "GestiónFelina",
    slug: config.slug ?? "gestion-felina",
    plugins: [
      ...(config.plugins ?? []),
      ["react-native-maps", androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}],
    ],
    extra: {
      ...config.extra,
      androidGoogleMapsConfigured: Boolean(androidGoogleMapsApiKey),
    },
  };
};
