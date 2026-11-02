import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";

import { ApiError } from "@felina/api-client";

/** Same defaults as the web app (30 s fresh data; no retries for client errors). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  });
}

// Refetch stale data when the app comes back to the foreground…
AppState.addEventListener("change", (status) => {
  if (Platform.OS !== "web") focusManager.setFocused(status === "active");
});

// …and when the connection comes back.
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    // Unknown (undefined) counts as online: only a definite "no connection" pauses queries.
    setOnline(state.isConnected !== false);
  });
  return () => subscription.remove();
});
