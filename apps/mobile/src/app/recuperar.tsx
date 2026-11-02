import { useForm } from "@tanstack/react-form";
import { MailCheck } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { Screen } from "@/components/app/screen";
import { PageHeader } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/**
 * Asks for a reset link. The email opens the web app's /restablecer page, where the new
 * password is chosen (the same flow as on the web).
 */
export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      // The response is the same whether or not the account exists (no user enumeration).
      await authClient.requestPasswordReset({
        email: value.email.trim(),
        redirectTo: "/restablecer",
      });
      setSentTo(value.email.trim());
    },
  });

  return (
    <Screen>
      <PageHeader
        title="Recupera tu contraseña"
        description="Te enviaremos un enlace para elegir una nueva."
      />
      {sentTo ? (
        <Card className="gap-3 p-5">
          <Icon icon={MailCheck} color="positive" size={22} />
          <Text className="text-sm text-foreground">
            Si existe una cuenta con <Text className="font-semibold">{sentTo}</Text>, recibirás un
            correo con el enlace en unos minutos. Revisa también la carpeta de spam.
          </Text>
        </Card>
      ) : (
        <View className="gap-4">
          <form.Field
            name="email"
            validators={{
              onSubmit: ({ value }) =>
                z.email().safeParse(value.trim()).success ? undefined : "Introduce un email válido",
            }}
          >
            {(field) => (
              <Field label="Email" error={field.state.meta.errors[0]}>
                <Input
                  autoComplete="email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onSubmitEditing={() => void form.handleSubmit()}
                  accessibilityLabel="Email"
                />
              </Field>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button loading={isSubmitting} onPress={() => void form.handleSubmit()}>
                Enviar enlace
              </Button>
            )}
          </form.Subscribe>
        </View>
      )}
    </Screen>
  );
}
