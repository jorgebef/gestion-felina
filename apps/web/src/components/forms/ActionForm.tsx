import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ACTION_STATUSES,
  ACTION_STATUS_LABELS,
  ACTION_TYPES,
  ACTION_TYPE_LABELS,
  catDisplayName,
  type ActionStatus,
  type ActionType,
} from "@felina/domain/felina";
import { actionInputSchema, type ActionInput } from "@felina/schemas/action";

import { MunicipalityPicker, type MunicipalityValue } from "@/components/felina/MunicipalityPicker";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { colonyLabels, fromDateTimeLocalValue } from "@/lib/format";
import { catOptionsQuery, colonyOptionsQuery, membersQuery } from "@/lib/queries";

export interface ActionFormValues {
  actionType: ActionType | "";
  name: string;
  description: string;
  scheduledAt: string; // datetime-local, Madrid time
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
  scheduledAt: "",
  isUrgent: false,
  status: "planned",
  colonyId: null,
  municipality: null,
  catIds: [],
  participantIds: [],
};

const NO_COLONY = "none";

function CheckList({
  legend,
  items,
  selected,
  onChange,
  empty,
}: {
  legend: string;
  items: { id: string; label: string; hint?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: string;
}) {
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((s) => s !== id));
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {legend} <span className="font-normal text-muted-foreground">({selected.length})</span>
      </legend>
      {items.length ? (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border bg-card">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              <Checkbox
                id={`${legend}-${item.id}`}
                checked={selected.includes(item.id)}
                onCheckedChange={(v) => toggle(item.id, v === true)}
              />
              <Label htmlFor={`${legend}-${item.id}`} className="flex-1 font-normal">
                {item.label}
                {item.hint ? (
                  <span className="ml-1 text-xs text-muted-foreground">{item.hint}</span>
                ) : null}
              </Label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </fieldset>
  );
}

export function ActionForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ActionFormValues;
  submitLabel: string;
  onSubmit: (values: ActionInput) => Promise<void>;
  onCancel?: () => void;
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
      (cats.data ?? [])
        .toSorted(
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
    const scheduledAt = fromDateTimeLocalValue(values.scheduledAt);
    const parsed = actionInputSchema.safeParse({
      actionType: values.actionType || undefined,
      name: values.name,
      description: values.description,
      scheduledAt: scheduledAt ?? undefined,
      isUrgent: values.isUrgent,
      status: values.status,
      colonyId: values.colonyId,
      municipalityCode: values.colonyId ? null : (values.municipality?.code ?? null),
      catIds: values.catIds,
      participantIds: values.participantIds,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
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
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-6"
    >
      <fieldset disabled={submitting} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="actionType" label="Tipo de acción" error={errors.actionType}>
            <Select
              items={ACTION_TYPE_LABELS}
              value={values.actionType || null}
              onValueChange={(v) => {
                if (!v) return;
                const type = v as ActionType;
                setValues((current) => ({
                  ...current,
                  actionType: type,
                  // Suggest a name the first time.
                  name: current.name || ACTION_TYPE_LABELS[type],
                }));
              }}
            >
              <SelectTrigger id="actionType" className="w-full bg-card">
                <SelectValue placeholder="Elige el tipo" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="name" label="Nombre" error={errors.name}>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              className="bg-card"
            />
          </Field>
          <Field id="scheduledAt" label="Fecha y hora" error={errors.scheduledAt}>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={values.scheduledAt}
              onChange={(e) => set("scheduledAt", e.target.value)}
              className="bg-card"
            />
          </Field>
          <Field id="status" label="Estado" error={errors.status}>
            <Select
              items={ACTION_STATUS_LABELS}
              value={values.status}
              onValueChange={(v) => v && set("status", v)}
            >
              <SelectTrigger id="status" className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ACTION_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
          <Switch
            id="isUrgent"
            checked={values.isUrgent}
            onCheckedChange={(v) => set("isUrgent", v)}
          />
          <Label htmlFor="isUrgent" className="font-normal">
            Es urgente
          </Label>
        </div>
        <Field id="description" label="Descripción" optional error={errors.description}>
          <Textarea
            id="description"
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className="bg-card"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="colony"
            label="Colonia"
            hint="El ayuntamiento de su municipio verá la acción en su feed."
            error={errors.colonyId}
          >
            <Select
              items={{ [NO_COLONY]: "Ninguna (gatos sueltos)", ...colonyLabels(colonies.data) }}
              value={values.colonyId ?? NO_COLONY}
              onValueChange={(v) => set("colonyId", !v || v === NO_COLONY ? null : v)}
            >
              <SelectTrigger id="colony" className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COLONY}>Ninguna (gatos sueltos)</SelectItem>
                {colonies.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!values.colonyId ? (
            <Field
              id="municipality"
              label="Municipio"
              optional
              hint="Si lo dejas vacío, se usa el del primer gato."
              error={errors.municipalityCode}
            >
              <MunicipalityPicker
                id="municipality"
                value={values.municipality}
                onChange={(m) => set("municipality", m)}
              />
            </Field>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <CheckList
            legend="Gatos"
            items={catItems}
            selected={values.catIds}
            onChange={(ids) => set("catIds", ids)}
            empty="Aún no hay gatos registrados."
          />
          <CheckList
            legend="Participantes"
            items={(members.data ?? []).map((m) => ({ id: m.userId, label: m.name || m.email }))}
            selected={values.participantIds}
            onChange={(ids) => set("participantIds", ids)}
            empty="Cargando el equipo…"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Si no eliges participantes, quedarás tú. Cada participante recibe un recordatorio por
          email el día de la acción.
        </p>
      </fieldset>
      <FormError message={formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
