import { Alert } from "react-native";

/**
 * Native confirmation for destructive or irreversible actions (the web app's
 * AlertDialog). Resolves to true when the person confirms.
 */
export function confirm({
  title,
  message,
  confirmLabel,
  destructive = true,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
