import { Loader2 } from "lucide-react";
import { useState } from "react";

import {
  associationRegistrationSchema,
  organizationUpdateSchema,
  type AssociationRegistration,
} from "@felina/schemas/organization";

import { MunicipalityPicker, type MunicipalityValue } from "@/components/felina/MunicipalityPicker";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";

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
 * Association data. On sign-up (`withMunicipality`) it also asks for the municipality of
 * the association's seat; afterwards that is not editable.
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
    type = "text",
  ) => (
    <Field id={key} label={label} optional={optional} error={errors[key]}>
      <Input
        id={key}
        type={type}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        className="bg-card"
      />
    </Field>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
    >
      <fieldset disabled={disabled || submitting} className="space-y-5">
        {text("name", withMunicipality ? "Nombre de la asociación" : "Nombre", false)}
        <div className="grid gap-5 sm:grid-cols-2">
          {text("taxId", "CIF")}
          {withMunicipality ? (
            <Field
              id="municipality"
              label="Municipio de la sede"
              optional
              error={errors.municipality}
            >
              <MunicipalityPicker
                id="municipality"
                value={values.municipality}
                onChange={(m) => set("municipality", m)}
                disabled={disabled || submitting}
              />
            </Field>
          ) : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("contactEmail", "Email de contacto", true, "email")}
          {text("contactPhone", "Teléfono de contacto", true, "tel")}
        </div>
        <Field
          id="description"
          label="Presentación"
          optional
          hint="Quiénes sois y dónde trabajáis. Ayuda a validar la solicitud."
          error={errors.description}
        >
          <Textarea
            id="description"
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className="bg-card"
          />
        </Field>
        <FormError message={formError} />
        {!disabled ? (
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {submitLabel}
          </Button>
        ) : null}
      </fieldset>
    </form>
  );
}
