import {
  GitPullRequestArrow,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react-native";
import { Alert, Text, View } from "react-native";

import { ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";

import { Screen } from "@/components/app/screen";
import { Card } from "@/components/ui/card";
import { MenuList } from "@/components/ui/menu-list";
import { useMembership, useSignOut } from "@/lib/session";

/** Everything that is in the web app's sidebar and user menu but not in a tab. */
export default function More() {
  const { viewer, organization } = useMembership();
  const signOut = useSignOut();
  const initial = (viewer.user.name || viewer.user.email).slice(0, 1).toUpperCase();

  return (
    <Screen>
      <Card className="flex-row items-center gap-3 p-4">
        <View className="size-11 items-center justify-center rounded-full bg-brand-soft">
          <Text className="text-lg font-semibold text-brand-strong">{initial}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-foreground">
            {viewer.user.name || viewer.user.email}
          </Text>
          <Text className="text-sm text-muted-foreground">{viewer.user.email}</Text>
          <Text className="text-xs text-muted-foreground">
            {ORGANIZATION_KIND_LABELS[organization.kind]} · {organization.name}
          </Text>
        </View>
      </Card>

      <MenuList
        title="Organización"
        items={[
          { label: "Propuestas", icon: GitPullRequestArrow, href: "/propuestas" },
          { label: "Equipo", icon: Users, href: "/equipo" },
          { label: "Ajustes de la organización", icon: Settings, href: "/ajustes" },
        ]}
      />
      <MenuList
        title="Cuenta"
        items={[
          { label: "Mi perfil", icon: UserRound, href: "/perfil" },
          ...(viewer.isPlatformAdmin
            ? [{ label: "Superadmin", icon: ShieldCheck, href: "/admin" as const }]
            : []),
          {
            label: "Cerrar sesión",
            icon: LogOut,
            destructive: true,
            onPress: () =>
              Alert.alert("¿Cerrar sesión?", undefined, [
                { text: "Cancelar", style: "cancel" },
                { text: "Cerrar sesión", style: "destructive", onPress: () => void signOut() },
              ]),
          },
        ]}
      />
    </Screen>
  );
}
