import { Loader2 } from "lucide-react";
import { useState } from "react";

import { colonyInputSchema, type ColonyInput } from "@felina/schemas/colony";

import {
  emptyLocation,
  LocationFields,
  locationPayload,
  type LocationValue,
} from "@/components/felina/LocationFields";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";

export interface ColonyFormValues {
  name: string;
  description: string;
  location: LocationValue;
}

export const emptyColony: ColonyFormValues = { name: "", description: "", location: emptyLocation };

export function ColonyForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ColonyFormValues;
  submitLabel: string;
  onSubmit: (values: ColonyInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const location = locationPayload(values.location);
    const parsed = colonyInputSchema.safeParse({
      name: values.name,
      description: values.description,
      ...(location.ok ? location.data : {}),
    });
    const next: Record<string, string> = location.ok ? {} : { ...location.errors };
    if (!parsed.success) {
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    }
    if (!location.ok || !parsed.success) {
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
        <Field id="name" label="Nombre de la colonia" error={errors.name}>
          <Input
            id="name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Parque del Oeste, solar de la calle Mayor…"
            className="bg-card"
          />
        </Field>
        <Field id="description" label="Descripción" optional error={errors.description}>
          <Textarea
            id="description"
            rows={3}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            placeholder="Puntos de alimentación, accesos, personas de contacto…"
            className="bg-card"
          />
        </Field>
      </fieldset>
      <LocationFields
        value={values.location}
        onChange={(location) => setValues((v) => ({ ...v, location }))}
        disabled={submitting}
        errors={{
          coordinates: errors.coordinates ?? errors.latitude,
          municipality: errors.municipality ?? errors.municipalityCode,
          address: errors.address,
        }}
      />
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
