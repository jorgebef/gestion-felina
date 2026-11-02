import { useState } from "react";
import { View } from "react-native";

import { errorMessage } from "@felina/client/errors";
import {
  associationRegistrationSchema,
  organizationUpdateSchema,
  type AssociationRegistration,
} from "@felina/schemas/organization";

import {
  MunicipalityPicker,
  type MunicipalityValue,
} from "@/components/felina/municipality-picker";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface OrganizationFormValues {
  name: string;
  taxId: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  municipality: MunicipalityValue | null;
}

export const emptyOrganization: OrganizationFormValues = {
  name: "",
  taxId: "",
  description: "",
  contactEmail: "",
  contactPhone: "",
  municipality: null,
};

type Errors = Partial<Record<keyof OrganizationFormValues, string>>;

/**
 * Association data, validated with the same schemas as the API. On sign-up
 * (`withMunicipality`) it also asks for the municipality of the association's seat.
 */
export function OrganizationForm({
  initial,
  withMunicipality = false,
  disabled = false,
  submitLabel,
  onSubmit,
}: {
  initial: OrganizationFormValues;
  withMunicipality?: boolean;
  disabled?: boolean;
  submitLabel: string;
  onSubmit: (values: AssociationRegistration) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = <K extends keyof OrganizationFormValues>(key: K, value: OrganizationFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const locked = disabled || submitting;

  const submit = async () => {
    const schema = withMunicipality ? associationRegistrationSchema : organizationUpdateSchema;
    const parsed = schema.safeParse({
      name: values.name,
      taxId: values.taxId,
      description: values.description,
      contactEmail: values.contactEmail,
      contactPhone: values.contactPhone,
      municipalityCode: values.municipality?.code ?? null,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "municipalityCode" ? "municipality" : issue.path[0];
        next[key as keyof Errors] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({ municipalityCode: null, ...parsed.data });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const text = (
    key: "name" | "taxId" | "contactEmail" | "contactPhone",
    label: string,
    optional = true,
    keyboardType: "default" | "email-address" | "phone-pad" = "default",
  ) => (
    <Field label={label} optional={optional} error={errors[key]}>
      <Input
        value={values[key]}
        onChangeText={(v) => set(key, v)}
        editable={!locked}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        accessibilityLabel={label}
      />
    </Field>
  );

  return (
    <View className="gap-5">
      {text("name", withMunicipality ? "Nombre de la asociación" : "Nombre", false)}
      {text("taxId", "CIF")}
      {withMunicipality ? (
        <Field label="Municipio de la sede" optional error={errors.municipality}>
          <MunicipalityPicker
            value={values.municipality}
            onChange={(m) => set("municipality", m)}
            disabled={locked}
            invalid={Boolean(errors.municipality)}
          />
        </Field>
      ) : null}
      {text("contactEmail", "Email de contacto", true, "email-address")}
      {text("contactPhone", "Teléfono de contacto", true, "phone-pad")}
      <Field
        label="Presentación"
        optional
        hint="Quiénes sois y dónde trabajáis. Ayuda a validar la solicitud."
        error={errors.description}
      >
        <Input
          multiline
          value={values.description}
          onChangeText={(v) => set("description", v)}
          editable={!locked}
          accessibilityLabel="Presentación"
        />
      </Field>
      <FormError message={formError} />
      {!disabled ? (
        <Button loading={submitting} onPress={() => void submit()}>
          {submitLabel}
        </Button>
      ) : null}
    </View>
  );
}
