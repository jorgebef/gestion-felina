import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

/** The native stack inside each tab, with a large title on its first screen. */
export function TabStack({ title }: { title: string }) {
  const [brand, foreground, background] = useCSSVariable([
    "--color-brand",
    "--color-foreground",
    "--color-background",
  ]).map(String);
  return (
    <Stack
      screenOptions={{
        headerTintColor: brand,
        headerTitleStyle: { color: foreground },
        headerLargeTitleEnabled: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: background },
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}

/** Header search bar (native) for list screens. */
export function searchBarOptions(placeholder: string, onChangeText: (text: string) => void) {
  return {
    placeholder,
    hideWhenScrolling: false,
    autoCapitalize: "none" as const,
    onChangeText: (e: { nativeEvent: { text: string } }) => onChangeText(e.nativeEvent.text),
    onCancelButtonPress: () => onChangeText(""),
  };
}
