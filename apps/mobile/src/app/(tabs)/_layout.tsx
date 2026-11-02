import { NativeTabs } from "expo-router/native-tabs";
import { useCSSVariable } from "uniwind";

import { useMembership } from "@/lib/session";

/**
 * Main sections, as in the web app's sidebar. Associations get "Acciones", town halls
 * their "Feed" of actions to validate (same tab). The rest lives under "Más".
 */
export default function TabsLayout() {
  const { isTownHall } = useMembership();
  const brand = useCSSVariable("--color-brand");
  return (
    <NativeTabs tintColor={String(brand)} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="panel">
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md="dashboard"
        />
        <NativeTabs.Trigger.Label>Panel</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="colonias">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        <NativeTabs.Trigger.Label>Colonias</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="gatos">
        <NativeTabs.Trigger.Icon
          sf={{ default: "pawprint", selected: "pawprint.fill" }}
          md="pets"
        />
        <NativeTabs.Trigger.Label>Gatos</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="acciones">
        <NativeTabs.Trigger.Icon
          sf={isTownHall ? { default: "newspaper", selected: "newspaper.fill" } : "checklist"}
          md={isTownHall ? "feed" : "checklist"}
        />
        <NativeTabs.Trigger.Label>{isTownHall ? "Feed" : "Acciones"}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mas">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
        <NativeTabs.Trigger.Label>Más</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
