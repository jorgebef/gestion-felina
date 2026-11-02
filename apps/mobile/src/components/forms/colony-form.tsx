import { useState } from "react";
import { View } from "react-native";

import { errorMessage } from "@felina/client/errors";
import { fieldErrors } from "@felina/client/forms";
import { colonyInputSchema, type ColonyInput } from "@felina/schemas/colony";

import {
  emptyLocation,
  LocationFields,
  locationPayload,
  type LocationValue,
} from "@/components/felina/location-fields";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
}: {
  initial: ColonyFormValues;
  submitLabel: string;
  onSubmit: (values: ColonyInput) => Promise<void>;
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
    const next = {
      ...(location.ok ? {} : location.errors),
      ...(parsed.success ? {} : fieldErrors(parsed.error.issues)),
    };
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
    <View className="gap-5">
      <Field label="Nombre de la colonia" error={errors.name}>
        <Input
          value={values.name}
          editable={!submitting}
          onChangeText={(name) => setValues((v) => ({ ...v, name }))}
          placeholder="Parque del Oeste, solar de la calle Mayor…"
          accessibilityLabel="Nombre de la colonia"
        />
      </Field>
      <Field label="Descripción" optional error={errors.description}>
        <Input
          multiline
          value={values.description}
          editable={!submitting}
          onChangeText={(description) => setValues((v) => ({ ...v, description }))}
          placeholder="Puntos de alimentación, accesos, personas de contacto…"
          accessibilityLabel="Descripción"
        />
      </Field>
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
      <Button loading={submitting} onPress={() => void submit()}>
        {submitLabel}
      </Button>
    </View>
  );
}
