import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area";

import { Logo } from "@/components/brand/logo";

/** Centered card for sign-in, sign-up and password screens (the web's AuthLayout). */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="grow justify-center px-5 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <Logo />
          </View>
          <Text className="text-2xl font-semibold tracking-tight text-foreground">{title}</Text>
          {subtitle ? <Text className="mt-1 text-sm text-muted-foreground">{subtitle}</Text> : null}
          <View className="mt-6">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
