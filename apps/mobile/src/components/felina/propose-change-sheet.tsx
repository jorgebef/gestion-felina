import { useQueryClient } from "@tanstack/react-query";
import { GitPullRequestArrow } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { toast } from "sonner-native";

import { CAT_SEX_LABELS, type CatSex } from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import type { MunicipalityValue } from "@felina/client/location";
import {
  changesFrom,
  initialDraft,
  str,
  type Draft,
  type ProposalTarget,
} from "@felina/client/proposals";
import { catChangesSchema, colonyChangesSchema } from "@felina/schemas/proposal";

import { Button } from "@/components/ui/button";
import { Checkbox, Select, SwitchRow } from "@/components/ui/controls";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area";
import { api } from "@/lib/api";

import { MunicipalityPicker } from "./municipality-picker";

/** Town halls propose changes; the managing association decides (sheet over the screen). */
export function ProposeChangeSheet({ target }: { target: ProposalTarget }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(target));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();
  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  const show = () => {
    setDraft(initialDraft(target));
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    const changes = changesFrom(target, draft);
    if (!Object.keys(changes).length) {
      setError("Cambia al menos un dato antes de enviar la propuesta.");
      return;
    }
    const schema = target.type === "colony" ? colonyChangesSchema : catChangesSchema;
    const parsed = schema.safeParse(changes);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const body = { changes: parsed.data, message: message.trim() || null };
      if (target.type === "colony") await api().colonies.propose(target.id, body as never);
      else await api().cats.propose(target.id, body as never);
      toast.success("Propuesta enviada a la asociación gestora");
      setOpen(false);
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const text = (key: string, label: string, multiline = false) => (
    <Field label={label}>
      <Input
        multiline={multiline}
        value={str(draft[key])}
        onChangeText={(v) => set(key, v)}
        keyboardType={
          key === "latitude" || key === "longitude" ? "numbers-and-punctuation" : "default"
        }
        accessibilityLabel={label}
      />
    </Field>
  );

  return (
    <>
      <Button variant="outline" icon={GitPullRequestArrow} onPress={show}>
        Proponer cambio
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
              <Text className="text-lg font-semibold text-foreground">Proponer un cambio</Text>
              <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                Cancelar
              </Button>
            </View>
            <ScrollView
              contentContainerClassName="gap-4 px-4 pb-10"
              keyboardShouldPersistTaps="handled"
            >
              <Text className="text-sm text-muted-foreground">
                Modifica los datos que quieras corregir. No se aplican hasta que la asociación
                gestora acepte la propuesta.
              </Text>
              {text("name", "Nombre")}
              {target.type === "cat" ? (
                <>
                  <Field label="Sexo">
                    <Select
                      value={String(draft.sex) as CatSex}
                      items={CAT_SEX_LABELS}
                      onValueChange={(v) => set("sex", v)}
                    />
                  </Field>
                  <Field label="Fecha de nacimiento" hint="AAAA-MM-DD, vacía si no se conoce.">
                    <Input
                      value={str(draft.birthDate)}
                      onChangeText={(v) => set("birthDate", v)}
                      placeholder="2023-04-01"
                      keyboardType="numbers-and-punctuation"
                      accessibilityLabel="Fecha de nacimiento"
                    />
                  </Field>
                  <Checkbox
                    label="La fecha es aproximada"
                    value={Boolean(draft.birthDateApproximate)}
                    onValueChange={(v) => set("birthDateApproximate", v)}
                  />
                  <SwitchRow
                    label="Castrado"
                    value={Boolean(draft.sterilized)}
                    onValueChange={(v) => set("sterilized", v)}
                  />
                </>
              ) : null}
              {text("description", "Descripción", true)}
              {text("address", "Dirección")}
              <Field label="Municipio">
                <MunicipalityPicker
                  value={draft.municipality as MunicipalityValue}
                  onChange={(m) => set("municipality", m)}
                />
              </Field>
              <View className="flex-row gap-3">
                <View className="flex-1">{text("latitude", "Latitud")}</View>
                <View className="flex-1">{text("longitude", "Longitud")}</View>
              </View>
              <Field label="Mensaje para la asociación" optional>
                <Input
                  multiline
                  value={message}
                  onChangeText={setMessage}
                  accessibilityLabel="Mensaje para la asociación"
                />
              </Field>
              <FormError message={error} />
              <Button loading={sending} onPress={() => void submit()}>
                Enviar propuesta
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
