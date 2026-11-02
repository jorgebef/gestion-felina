import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  catDisplayName,
  type ActionStatus,
  type ActionType,
} from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { fieldErrors } from "@felina/client/forms";
import { colonyLabels } from "@felina/client/format";
import type { MunicipalityValue } from "@felina/client/location";
import { actionInputSchema, type ActionInput } from "@felina/schemas/action";

import { MunicipalityPicker } from "@/components/felina/municipality-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateField, Select, SwitchRow } from "@/components/ui/controls";
import { Field, FormError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { catOptionsQuery, colonyOptionsQuery, membersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export interface ActionFormValues {
  actionType: ActionType | "";
  name: string;
  description: string;
  scheduledAt: Date | null;
  isUrgent: boolean;
  status: ActionStatus;
  colonyId: string | null;
  municipality: MunicipalityValue | null;
  catIds: string[];
  participantIds: string[];
}

export const emptyAction: ActionFormValues = {
  actionType: "",
  name: "",
  description: "",
  scheduledAt: null,
  isUrgent: false,
  status: "planned",
  colonyId: null,
  municipality: null,
  catIds: [],
  participantIds: [],
};

const NO_COLONY = "none";

/** Multiple choice as tappable rows with a check mark. */
function CheckList({
  legend,
  items,
  selected,
  onChange,
  empty,
  disabled,
}: {
  legend: string;
  items: { id: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
  disabled?: boolean;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">
        {legend} <Text className="font-normal text-muted-foreground">({selected.length})</Text>
      </Text>
      {items.length ? (
        <Card>
          {items.map((item, i) => {
            const on = selected.includes(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled }}
                accessibilityLabel={item.label}
                disabled={disabled}
                onPress={() => toggle(item.id)}
                className={cn(
                  "flex-row items-center gap-3 px-4 py-3 active:bg-muted",
                  i > 0 && "border-t border-border",
                )}
              >
                <View
                  className={cn(
                    "size-5 items-center justify-center rounded border",
                    on ? "border-brand bg-brand" : "border-input bg-card",
                  )}
                >
                  {on ? <Icon icon={Check} color="primary-foreground" size={14} /> : null}
                </View>
                <Text className="flex-1 text-base text-foreground">
                  {item.label}
                  {item.hint ? (
                    <Text className="text-xs text-muted-foreground"> {item.hint}</Text>
                  ) : null}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Text className="text-sm text-muted-foreground">{empty}</Text>
      )}
    </View>
  );
}

/** Same fields and validation as the web app's action form (shared zod schema). */
export function ActionForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: ActionFormValues;
  submitLabel: string;
  onSubmit: (values: ActionInput) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const colonies = useQuery(colonyOptionsQuery);
  const cats = useQuery(catOptionsQuery);
  const members = useQuery(membersQuery);
  const set = <K extends keyof ActionFormValues>(key: K, value: ActionFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const colonyNames = useMemo(
    () => new Map((colonies.data ?? []).map((c) => [c.id, c.name])),
    [colonies.data],
  );
  // Cats of the chosen colony first, then the rest.
  const catItems = useMemo(
    () =>
      [...(cats.data ?? [])]
        .sort(
          (a, b) => Number(b.colonyId === values.colonyId) - Number(a.colonyId === values.colonyId),
        )
        .map((c) => ({
          id: c.id,
          label: catDisplayName(c),
          hint: c.colonyId ? colonyNames.get(c.colonyId) : "sin colonia",
        })),
    [cats.data, colonyNames, values.colonyId],
  );

  const submit = async () => {
    const parsed = actionInputSchema.safeParse({
      actionType: values.actionType || undefined,
      name: values.name,
      description: values.description,
      scheduledAt: values.scheduledAt?.toISOString(),
      isUrgent: values.isUrgent,
      status: values.status,
      colonyId: values.colonyId,
      municipalityCode: values.colonyId ? null : (values.municipality?.code ?? null),
      catIds: values.catIds,
      participantIds: values.participantIds,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <View className="gap-5">
      <Field label="Tipo de acción" error={errors.actionType}>
        <Select
          value={values.actionType}
          items={{ "": "Elige el tipo", ...ACTION_TYPE_LABELS }}
          disabled={submitting}
          onValueChange={(v) => {
            if (!v) return;
            setValues((current) => ({
              ...current,
              actionType: v,
              // Suggest a name the first time.
              name: current.name || ACTION_TYPE_LABELS[v],
            }));
          }}
        />
      </Field>
      <Field label="Nombre" error={errors.name}>
        <Input
          value={values.name}
          editable={!submitting}
          onChangeText={(v) => set("name", v)}
          accessibilityLabel="Nombre"
        />
      </Field>
      <Field label="Fecha y hora" error={errors.scheduledAt}>
        {values.scheduledAt ? (
          <DateField
            mode="datetime"
            value={values.scheduledAt}
            disabled={submitting}
            onChange={(date) => set("scheduledAt", date)}
          />
        ) : (
          <Button
            variant="outline"
            className="self-start"
            onPress={() => {
              const next = new Date();
              next.setMinutes(0, 0, 0);
              next.setHours(next.getHours() + 1);
              set("scheduledAt", next);
            }}
          >
            Elegir fecha y hora
          </Button>
        )}
      </Field>
      <Field label="Estado" error={errors.status}>
        <Select
          value={values.status}
          items={ACTION_STATUS_LABELS}
          disabled={submitting}
          onValueChange={(v) => set("status", v)}
        />
      </Field>
      <SwitchRow
        label="Es urgente"
        value={values.isUrgent}
        disabled={submitting}
        onValueChange={(v) => set("isUrgent", v)}
      />
      <Field label="Descripción" optional error={errors.description}>
        <Input
          multiline
          value={values.description}
          editable={!submitting}
          onChangeText={(v) => set("description", v)}
          accessibilityLabel="Descripción"
        />
      </Field>
      <Field
        label="Colonia"
        hint="El ayuntamiento de su municipio verá la acción en su feed."
        error={errors.colonyId}
      >
        <Select
          value={values.colonyId ?? NO_COLONY}
          items={{ [NO_COLONY]: "Ninguna (gatos sueltos)", ...colonyLabels(colonies.data) }}
          disabled={submitting}
          onValueChange={(v) => set("colonyId", v === NO_COLONY ? null : v)}
        />
      </Field>
      {!values.colonyId ? (
        <Field
          label="Municipio"
          optional
          hint="Si lo dejas vacío, se usa el del primer gato."
          error={errors.municipalityCode}
        >
          <MunicipalityPicker
            value={values.municipality}
            disabled={submitting}
            onChange={(m) => set("municipality", m)}
          />
        </Field>
      ) : null}
      <CheckList
        legend="Gatos"
        items={catItems}
        selected={values.catIds}
        disabled={submitting}
        onChange={(ids) => set("catIds", ids)}
        empty="Aún no hay gatos registrados."
      />
      <CheckList
        legend="Participantes"
        items={(members.data ?? []).map((m) => ({ id: m.userId, label: m.name || m.email }))}
        selected={values.participantIds}
        disabled={submitting}
        onChange={(ids) => set("participantIds", ids)}
        empty="Cargando el equipo…"
      />
      <Text className="text-xs text-muted-foreground">
        Si no eliges participantes, quedarás tú. Cada participante recibe un recordatorio por email
        el día de la acción.
      </Text>
      <FormError message={formError} />
      <Button loading={submitting} onPress={() => void submit()}>
        {submitLabel}
      </Button>
    </View>
  );
}
