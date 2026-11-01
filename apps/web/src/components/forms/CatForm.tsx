import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPinned } from "lucide-react";
import { useState } from "react";

import { CAT_SEXES, CAT_SEX_LABELS, type CatSex } from "@felina/domain/felina";
import { catInputSchema, type CatInput } from "@felina/schemas/cat";

import { PhotoInput } from "@/components/felina/CatPhoto";
import {
  emptyLocation,
  LocationFields,
  locationPayload,
  type LocationValue,
} from "@/components/felina/LocationFields";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { colonyOptionsQuery } from "@/lib/queries";

export interface CatFormValues {
  photoKey: string | null;
  name: string;
  sex: CatSex;
  birthDate: string;
  birthDateApproximate: boolean;
  description: string;
  colonyId: string | null;
  location: LocationValue;
}

export const emptyCat: CatFormValues = {
  photoKey: null,
  name: "",
  sex: "unknown",
  birthDate: "",
  birthDateApproximate: false,
  description: "",
  colonyId: null,
  location: emptyLocation,
};

const NO_COLONY = "none";

export function CatForm({
  initial,
  currentPhotoUrl,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: CatFormValues;
  currentPhotoUrl?: string;
  submitLabel: string;
  onSubmit: (values: CatInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const colonies = useQuery(colonyOptionsQuery);
  const set = <K extends keyof CatFormValues>(key: K, value: CatFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const colony = colonies.data?.find((c) => c.id === values.colonyId);

  const applyColonyLocation = (target = colony) => {
    if (!target) return;
    set("location", {
      latitude: target.latitude,
      longitude: target.longitude,
      municipality: { code: target.municipalityCode, name: target.municipalityName },
      address: target.address ?? "",
    });
  };

  const submit = async () => {
    const location = locationPayload(values.location);
    const parsed = catInputSchema.safeParse({
      photoKey: values.photoKey ?? undefined,
      name: values.name,
      sex: values.sex,
      birthDate: values.birthDate,
      birthDateApproximate: values.birthDateApproximate,
      description: values.description,
      colonyId: values.colonyId,
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
      <Field id="photo" label="Foto principal" error={undefined}>
        <PhotoInput
          photoKey={values.photoKey}
          currentUrl={currentPhotoUrl}
          onChange={(key) => set("photoKey", key)}
          error={errors.photoKey}
          disabled={submitting}
        />
      </Field>

      <fieldset disabled={submitting} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Nombre" optional error={errors.name}>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              className="bg-card"
            />
          </Field>
          <Field id="colony" label="Colonia" error={errors.colonyId}>
            <Select
              value={values.colonyId ?? NO_COLONY}
              onValueChange={(v) => {
                const colonyId = v === NO_COLONY ? null : v;
                set("colonyId", colonyId);
                // A cat joining a colony usually lives there: suggest its location.
                if (colonyId && values.location.latitude === null) {
                  applyColonyLocation(colonies.data?.find((c) => c.id === colonyId));
                }
              }}
            >
              <SelectTrigger id="colony" className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COLONY}>Sin colonia</SelectItem>
                {colonies.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field id="sex" label="Sexo" error={errors.sex}>
          <RadioGroup
            id="sex"
            value={values.sex}
            onValueChange={(v) => set("sex", v as CatSex)}
            className="flex flex-wrap gap-4"
          >
            {CAT_SEXES.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <RadioGroupItem id={`sex-${s}`} value={s} />
                <Label htmlFor={`sex-${s}`} className="font-normal">
                  {CAT_SEX_LABELS[s]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="birthDate"
            label="Fecha de nacimiento"
            optional
            hint="Déjala vacía si no se conoce."
            error={errors.birthDate}
          >
            <Input
              id="birthDate"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={values.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
              className="bg-card"
            />
          </Field>
          <div className="flex items-center gap-2 sm:pt-7">
            <Checkbox
              id="birthDateApproximate"
              checked={values.birthDateApproximate}
              disabled={!values.birthDate}
              onCheckedChange={(v) => set("birthDateApproximate", v === true)}
            />
            <Label htmlFor="birthDateApproximate" className="font-normal">
              Es una fecha aproximada
            </Label>
          </div>
        </div>

        <Field id="description" label="Descripción" optional error={errors.description}>
          <Textarea
            id="description"
            rows={3}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Capa, marcas, carácter, estado de salud…"
            className="bg-card"
          />
        </Field>
      </fieldset>

      <div className="space-y-3">
        {colony ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() => applyColonyLocation()}
            disabled={submitting}
          >
            <MapPinned /> Usar la ubicación de «{colony.name}»
          </Button>
        ) : null}
        <LocationFields
          value={values.location}
          onChange={(location) => set("location", location)}
          disabled={submitting}
          context={
            colony
              ? [
                  {
                    id: colony.id,
                    latitude: colony.latitude,
                    longitude: colony.longitude,
                    label: `Colonia ${colony.name}`,
                    tone: "muted",
                  },
                ]
              : []
          }
          errors={{
            coordinates: errors.coordinates ?? errors.latitude,
            municipality: errors.municipality ?? errors.municipalityCode,
            address: errors.address,
          }}
        />
      </div>

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
