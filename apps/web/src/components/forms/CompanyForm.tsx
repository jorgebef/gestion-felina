import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { provincesByRegion } from "@licita/domain/provinces";
import { errorMessage } from "@/lib/errors";
import {
  COMPANY_TYPES,
  COMPANY_TYPE_LABELS,
  companyInputSchema,
  type CompanyInput,
} from "@licita/schemas/company";

export interface CompanyFormValues {
  legalName: string;
  displayName: string;
  companyType: string;
  baseProvinceCode: string;
  baseMunicipality: string;
  businessDescription: string;
  taxId: string;
}

const REGIONS = provincesByRegion();

export function CompanyForm({
  initial,
  extended = false,
  disabled = false,
  submitLabel,
  onSubmit,
}: {
  initial: CompanyFormValues;
  /** Settings show the optional fields that onboarding skips. */
  extended?: boolean;
  disabled?: boolean;
  submitLabel: string;
  onSubmit: (values: CompanyInput) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof CompanyFormValues, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = async () => {
    const parsed = companyInputSchema.safeParse({
      ...values,
      companyType: values.companyType || undefined,
    });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as keyof CompanyFormValues] ??= issue.message;
      }
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
    } finally {
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
      className="space-y-5"
    >
      <fieldset disabled={disabled || submitting} className="space-y-5">
        <Field
          id="legalName"
          label="Nombre de la empresa o del profesional"
          error={errors.legalName}
        >
          <Input
            id="legalName"
            autoComplete="organization"
            value={values.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            className="bg-card"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="companyType" label="Tipo" optional error={errors.companyType}>
            <Select value={values.companyType} onValueChange={(v) => set("companyType", v)}>
              <SelectTrigger id="companyType" className="w-full bg-card">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {COMPANY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="baseProvinceCode"
            label="Provincia de la sede"
            optional
            error={errors.baseProvinceCode}
          >
            <Select
              value={values.baseProvinceCode}
              onValueChange={(v) => set("baseProvinceCode", v)}
            >
              <SelectTrigger id="baseProvinceCode" className="w-full bg-card">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {REGIONS.map((group) => (
                  <SelectGroup key={group.region}>
                    <SelectLabel>{group.region}</SelectLabel>
                    {group.provinces.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {extended ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="displayName" label="Nombre comercial" optional error={errors.displayName}>
                <Input
                  id="displayName"
                  value={values.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  className="bg-card"
                />
              </Field>
              <Field
                id="baseMunicipality"
                label="Municipio"
                optional
                error={errors.baseMunicipality}
              >
                <Input
                  id="baseMunicipality"
                  value={values.baseMunicipality}
                  onChange={(e) => set("baseMunicipality", e.target.value)}
                  className="bg-card"
                />
              </Field>
            </div>
            <Field
              id="taxId"
              label="NIF / CIF"
              optional
              hint="No es necesario para usar la plataforma."
              error={errors.taxId}
            >
              <Input
                id="taxId"
                value={values.taxId}
                onChange={(e) => set("taxId", e.target.value)}
                className="bg-card uppercase"
              />
            </Field>
            <Field
              id="businessDescription"
              label="Presentación de la empresa"
              optional
              error={errors.businessDescription}
            >
              <Textarea
                id="businessDescription"
                rows={3}
                value={values.businessDescription}
                onChange={(e) => set("businessDescription", e.target.value)}
                className="bg-card"
              />
            </Field>
          </>
        ) : null}
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
