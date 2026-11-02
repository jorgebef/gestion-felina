import "../global.css";

import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";
import { useCSSVariable } from "uniwind";

import { ApiError } from "@felina/api-client";

import { ErrorState } from "@/components/app/states";
import { viewerQuery } from "@/lib/queries";
import { createQueryClient } from "@/lib/query-client";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => {
    const client = createQueryClient();
    // An expired session anywhere sends the person back to the login screen.
    client.getQueryCache().config.onError = (error) => {
      if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
        void client.invalidateQueries({ queryKey: viewerQuery.queryKey });
      }
    };
    return client;
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Navigator />
        <Toaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export const unstable_settings = { anchor: "index" };

/**
 * Which screens exist depends on the viewer, like the web app's route guards:
 * anonymous → sign in; no approved organization → onboarding; approved → the app;
 * platform admins also get the administration screens.
 */
function Navigator() {
  const viewer = useQuery(viewerQuery);
  const [brand, foreground, background] = useCSSVariable([
    "--color-brand",
    "--color-foreground",
    "--color-background",
  ]).map(String);
  const done = !viewer.isPending;
  useEffect(() => {
    if (done) void SplashScreen.hideAsync();
  }, [done]);

  if (viewer.isPending) return null;
  if (viewer.isError && viewer.data === undefined) {
    return (
      <View className="flex-1 justify-center bg-background px-4">
        <ErrorState error={viewer.error} onRetry={() => void viewer.refetch()} />
      </View>
    );
  }

  const v = viewer.data ?? null;
  const approved = v?.membership?.organization.status === "approved";
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: brand,
        headerTitleStyle: { color: foreground },
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="invitacion/[token]" options={{ title: "Invitación" }} />

      <Stack.Protected guard={!v}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="recuperar" options={{ title: "Recuperar contraseña" }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(v) && !approved}>
        <Stack.Screen name="onboarding" options={{ title: "Bienvenida" }} />
      </Stack.Protected>

      <Stack.Protected guard={approved}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="colonias/nueva"
          options={{ title: "Nueva colonia", presentation: "modal" }}
        />
        <Stack.Screen name="colonias/[colonyId]/index" options={{ title: "Colonia" }} />
        <Stack.Screen
          name="colonias/[colonyId]/editar"
          options={{ title: "Editar colonia", presentation: "modal" }}
        />
        <Stack.Screen name="gatos/nuevo" options={{ title: "Nuevo gato", presentation: "modal" }} />
        <Stack.Screen name="gatos/[catId]/index" options={{ title: "Gato" }} />
        <Stack.Screen
          name="gatos/[catId]/editar"
          options={{ title: "Editar gato", presentation: "modal" }}
        />
        <Stack.Screen
          name="acciones/nueva"
          options={{ title: "Nueva acción", presentation: "modal" }}
        />
        <Stack.Screen name="acciones/[actionId]/index" options={{ title: "Acción" }} />
        <Stack.Screen
          name="acciones/[actionId]/editar"
          options={{ title: "Editar acción", presentation: "modal" }}
        />
        <Stack.Screen name="propuestas" options={{ title: "Propuestas" }} />
        <Stack.Screen name="eliminaciones" options={{ title: "Eliminaciones" }} />
        <Stack.Screen name="equipo" options={{ title: "Equipo" }} />
        <Stack.Screen name="ajustes" options={{ title: "Ajustes" }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(v)}>
        <Stack.Screen name="perfil" options={{ title: "Mi perfil" }} />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(v?.isPlatformAdmin)}>
        <Stack.Screen name="admin/index" options={{ title: "Organizaciones" }} />
        <Stack.Screen name="admin/[orgId]" options={{ title: "Organización" }} />
      </Stack.Protected>
    </Stack>
  );
}
