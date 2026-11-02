import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { toast } from "sonner-native";

import { errorMessage } from "@felina/client/errors";
import type { MunicipalityValue } from "@felina/client/location";
import { townHallCreateSchema } from "@felina/schemas/organization";

import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area";
import { api } from "@/lib/api";

import { MunicipalityPicker } from "./municipality-picker";

/** Super admin: registers a town hall (approved from the start) and invites its admin. */
export function NewTownHallSheet() {
  const [open, setOpen] = useState(false);
  const [municipality, setMunicipality] = useState<MunicipalityValue | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: () => {
      const parsed = townHallCreateSchema.safeParse({
        municipalityCode: municipality?.code ?? "",
        adminEmail,
        name,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api().admin.createTownHall(parsed.data);
    },
    onSuccess: async (result) => {
      toast.success(
        result.emailSent
          ? `Ayuntamiento creado e invitación enviada a ${adminEmail}`
          : "Ayuntamiento creado, pero el email no se pudo enviar",
      );
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      router.push(`/admin/${result.id}`);
    },
    onError: (e) => setError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e)),
  });

  return (
    <>
      <Button
        icon={Plus}
        onPress={() => {
          setMunicipality(null);
          setAdminEmail("");
          setName("");
          setError(null);
          setOpen(true);
        }}
      >
        Nuevo ayuntamiento
      </Button>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
              <Text className="text-lg font-semibold text-foreground">
                Dar de alta un ayuntamiento
              </Text>
              <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                Cancelar
              </Button>
            </View>
            <ScrollView
              contentContainerClassName="gap-4 px-4 pb-10"
              keyboardShouldPersistTaps="handled"
            >
              <Text className="text-sm text-muted-foreground">
                Queda aprobado desde el principio. Solo puede haber uno por municipio. La persona
                invitada será su primera administradora.
              </Text>
              <Field label="Municipio">
                <MunicipalityPicker value={municipality} onChange={setMunicipality} />
              </Field>
              <Field
                label="Nombre"
                optional
                hint={
                  municipality ? `Por defecto: Ayuntamiento de ${municipality.name}` : undefined
                }
              >
                <Input value={name} onChangeText={setName} accessibilityLabel="Nombre" />
              </Field>
              <Field label="Email de la persona responsable">
                <Input
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Email de la persona responsable"
                />
              </Field>
              <FormError message={error} />
              <Button
                loading={create.isPending}
                onPress={() => {
                  setError(null);
                  create.mutate();
                }}
              >
                Crear e invitar
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
