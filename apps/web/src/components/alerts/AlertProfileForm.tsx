import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Field, FormError, fieldError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { sectorById } from "@licita/domain/sectors";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_HINTS,
  CONTRACT_TYPE_LABELS,
  EMAIL_FREQUENCIES,
  EMAIL_FREQUENCY_LABELS,
  type ContractType,
  type EmailFrequencyValue,
} from "@licita/domain/tenders";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { alertProfileInputSchema, type AlertProfileValues } from "@licita/schemas/alert-profile";

import { ChipInput } from "./ChipInput.tsx";
import { CpvPicker, type CpvOption } from "./CpvPicker.tsx";
import { ProvincePicker } from "./ProvincePicker.tsx";
import { SectorPicker } from "./SectorPicker.tsx";

export interface AlertProfileFormValues {
  name: string;
  serviceDescription: string;
  sectors: string[];
  cpv: CpvOption[];
  includeKeywords: string[];
  excludeKeywords: string[];
  provinceCodes: string[];
  nationwide: boolean;
  contractTypes: ContractType[];
  minBudget: string;
  maxBudget: string;
  emailFrequency: EmailFrequencyValue;
  isActive: boolean;
}

export function emptyProfileValues(
  defaults: Partial<AlertProfileFormValues> = {},
): AlertProfileFormValues {
  return {
    name: "Mi perfil de alertas",
    serviceDescription: "",
    sectors: [],
    cpv: [],
    includeKeywords: [],
    excludeKeywords: [],
    provinceCodes: [],
    nationwide: false,
    contractTypes: [],
    minBudget: "",
    maxBudget: "",
    emailFrequency: "daily",
    isActive: true,
    ...defaults,
  };
}

function parseAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type Errors = Partial<Record<string, string>>;

function validate(values: AlertProfileFormValues) {
  const result = alertProfileInputSchema.safeParse({
    name: values.name,
    serviceDescription: values.serviceDescription,
    sectors: values.sectors,
    cpvCodes: values.cpv.map((c) => c.code),
    includeKeywords: values.includeKeywords,
    excludeKeywords: values.excludeKeywords,
    provinceCodes: values.provinceCodes,
    nationwide: values.nationwide,
    contractTypes: values.contractTypes,
    minBudgetEur: parseAmount(values.minBudget),
    maxBudgetEur: parseAmount(values.maxBudget),
    emailFrequency: values.emailFrequency,
    isActive: values.isActive,
  });
  if (result.success) return { data: result.data, errors: {} as Errors };
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { data: null, errors };
}

const STEP_FIELDS: string[][] = [
  ["name", "serviceDescription", "sectors", "cpvCodes", "includeKeywords", "excludeKeywords"],
  ["provinceCodes"],
  ["contractTypes", "minBudgetEur", "maxBudgetEur", "emailFrequency"],
];

const STEPS = [
  {
    title: "¿Qué hace tu empresa?",
    description: "Con tus palabras. Con esto buscamos licitaciones afines.",
  },
  {
    title: "¿Dónde puedes trabajar?",
    description: "Provincias en las que puedes ejecutar contratos.",
  },
  {
    title: "¿Qué contratos te interesan?",
    description: "Tipo, importe y cada cuánto quieres recibir avisos.",
  },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function AlertProfileForm({
  initial,
  wizard = false,
  submitLabel = "Guardar perfil",
  onSubmit,
  onCancel,
}: {
  initial: AlertProfileFormValues;
  wizard?: boolean;
  submitLabel?: string;
  onSubmit: (values: AlertProfileValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const set = <K extends keyof AlertProfileFormValues>(key: K, value: AlertProfileFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const sectorKeywords = [
    ...new Set(values.sectors.flatMap((id) => sectorById(id)?.keywords ?? [])),
  ].filter((k) => !values.includeKeywords.some((i) => i.toLowerCase() === k.toLowerCase()));

  const stepValid = (index: number) => {
    const { errors: all } = validate(values);
    const relevant = Object.fromEntries(
      Object.entries(all).filter(([k]) => STEP_FIELDS[index]!.includes(k)),
    );
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  };

  const submit = async () => {
    const { data, errors: all } = validate(values);
    setErrors(all);
    if (!data) {
      if (wizard) {
        const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => all[f]));
        if (first >= 0) setStep(first);
      }
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit(data);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const activity = (
    <Section
      title={wizard ? STEPS[0]!.title : "Actividad"}
      description={
        wizard
          ? STEPS[0]!.description
          : "Qué ofrece tu empresa. Es lo que usamos para encontrar coincidencias."
      }
    >
      <Field
        id="name"
        label="Nombre del perfil"
        hint="Para distinguirlo si creas varios."
        error={errors.name}
      >
        <Input
          id="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          className="bg-card"
        />
      </Field>
      <Field
        id="serviceDescription"
        label="Describe tus servicios o productos"
        hint="Ejemplo: «Limpieza de oficinas, colegios y centros de salud, y mantenimiento de zonas verdes»."
        error={errors.serviceDescription}
      >
        <Textarea
          id="serviceDescription"
          rows={3}
          value={values.serviceDescription}
          onChange={(e) => set("serviceDescription", e.target.value)}
          className="bg-card"
        />
      </Field>
      <div className="space-y-2">
        <Label>Sectores</Label>
        <p className="text-xs text-muted-foreground">
          Opcional. Elegir un sector te propone códigos CPV y palabras clave, que puedes revisar.
        </p>
        <SectorPicker value={values.sectors} onChange={(ids) => set("sectors", ids)} />
      </div>
      <Field
        id="includeKeywords"
        label="Palabras clave que deben aparecer"
        optional
        hint="Pulsa Intro para añadir cada una. Basta con que aparezca una."
        error={errors.includeKeywords}
      >
        <ChipInput
          id="includeKeywords"
          value={values.includeKeywords}
          onChange={(v) => set("includeKeywords", v)}
          placeholder="p. ej. limpieza, jardinería"
        />
      </Field>
      {sectorKeywords.length ? (
        <div className="-mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Sugeridas:</span>
          {sectorKeywords.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set("includeKeywords", [...values.includeKeywords, k])}
              className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs hover:border-brand hover:text-brand"
            >
              <Plus className="size-3" />
              {k}
            </button>
          ))}
        </div>
      ) : null}
      <Field
        id="excludeKeywords"
        label="Palabras para descartar"
        optional
        hint="Si el anuncio las contiene, no te avisaremos. Ej.: «suministro», «viaria»."
        error={errors.excludeKeywords}
      >
        <ChipInput
          id="excludeKeywords"
          tone="negative"
          value={values.excludeKeywords}
          onChange={(v) => set("excludeKeywords", v)}
          placeholder="p. ej. alquiler"
        />
      </Field>
      <div className="space-y-2">
        <Label>Códigos CPV</Label>
        <p className="text-xs text-muted-foreground">
          Opcional. El CPV es la clasificación oficial que usan los organismos para cada contrato.
          Mejora la precisión, pero no necesitas conocerlo.
        </p>
        <CpvPicker
          value={values.cpv}
          onChange={(cpv) => set("cpv", cpv)}
          description={values.serviceDescription}
          sectors={values.sectors}
        />
        {fieldError(errors.cpvCodes) ? (
          <p className="text-xs text-negative">{errors.cpvCodes}</p>
        ) : null}
      </div>
    </Section>
  );

  const territory = (
    <Section
      title={wizard ? STEPS[1]!.title : "Territorio"}
      description={
        wizard ? STEPS[1]!.description : "Provincias en las que puedes ejecutar contratos."
      }
    >
      <ProvincePicker
        value={values.provinceCodes}
        nationwide={values.nationwide}
        onChange={(codes) => set("provinceCodes", codes)}
        onNationwideChange={(on) => set("nationwide", on)}
      />
      {errors.provinceCodes ? (
        <p className="text-xs text-negative">{errors.provinceCodes}</p>
      ) : null}
    </Section>
  );

  const contracts = (
    <Section
      title={wizard ? STEPS[2]!.title : "Contratos y avisos"}
      description={wizard ? STEPS[2]!.description : undefined}
    >
      <div className="space-y-2">
        <Label>Tipos de contrato</Label>
        <p className="text-xs text-muted-foreground">Si no marcas ninguno, te mostraremos todos.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTRACT_TYPES.map((type) => {
            const on = values.contractTypes.includes(type);
            return (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border bg-card p-3",
                  on && "border-brand bg-brand-soft/60",
                )}
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(checked) =>
                    set(
                      "contractTypes",
                      checked
                        ? [...values.contractTypes, type]
                        : values.contractTypes.filter((t) => t !== type),
                    )
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{CONTRACT_TYPE_LABELS[type]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {CONTRACT_TYPE_HINTS[type]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="minBudget"
          label="Presupuesto mínimo (€, sin IVA)"
          optional
          error={errors.minBudgetEur}
        >
          <Input
            id="minBudget"
            inputMode="decimal"
            placeholder="p. ej. 15.000"
            value={values.minBudget}
            onChange={(e) => set("minBudget", e.target.value)}
            className="bg-card"
          />
        </Field>
        <Field
          id="maxBudget"
          label="Presupuesto máximo (€, sin IVA)"
          optional
          error={errors.maxBudgetEur}
        >
          <Input
            id="maxBudget"
            inputMode="decimal"
            placeholder="Sin límite"
            value={values.maxBudget}
            onChange={(e) => set("maxBudget", e.target.value)}
            className="bg-card"
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Se compara con el presupuesto base de licitación sin IVA publicado por el organismo.
      </p>
      <div className="space-y-2">
        <Label>Avisos por correo</Label>
        <RadioGroup
          value={values.emailFrequency}
          onValueChange={(v) => set("emailFrequency", v as EmailFrequencyValue)}
          className="grid gap-2 sm:grid-cols-2"
        >
          {EMAIL_FREQUENCIES.map((f) => (
            <label
              key={f}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card p-3 text-sm"
            >
              <RadioGroupItem value={f} />
              {EMAIL_FREQUENCY_LABELS[f]}
            </label>
          ))}
        </RadioGroup>
      </div>
      {!wizard ? (
        <label className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
          <span>
            <span className="block text-sm font-medium">Perfil activo</span>
            <span className="block text-xs text-muted-foreground">
              Si lo desactivas, dejamos de buscar coincidencias y de enviarte avisos.
            </span>
          </span>
          <Switch checked={values.isActive} onCheckedChange={(on) => set("isActive", on)} />
        </label>
      ) : null}
    </Section>
  );

  if (wizard) {
    const last = step === STEPS.length - 1;
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!last) {
            if (stepValid(step)) setStep(step + 1);
          } else void submit();
        }}
        className="space-y-5"
      >
        <ol className="flex gap-2" aria-label="Pasos">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex-1">
              <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-border")} />
              <span
                className={cn(
                  "mt-1.5 hidden text-xs sm:block",
                  i === step ? "font-medium" : "text-muted-foreground",
                )}
              >
                {i + 1}. {s.title}
              </span>
            </li>
          ))}
        </ol>
        {step === 0 ? activity : step === 1 ? territory : contracts}
        <FormError message={formError} />
        <div className="flex justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft />
            Atrás
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {last ? submitLabel : "Continuar"}
            {!last ? <ArrowRight /> : null}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
    >
      {activity}
      {territory}
      {contracts}
      <FormError message={formError} />
      {Object.keys(errors).length ? (
        <p className="text-sm text-negative">Revisa los campos marcados.</p>
      ) : null}
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
