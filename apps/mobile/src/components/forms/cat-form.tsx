import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, MapPinned, X } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { CAT_SEX_LABELS, type CatSex } from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { fieldErrors } from "@felina/client/forms";
import { colonyLabels } from "@felina/client/format";
import { catInputSchema, type CatInput } from "@felina/schemas/cat";

import { PhotoInput } from "@/components/felina/cat-photo";
import {
  emptyLocation,
  LocationFields,
  locationPayload,
  type LocationValue,
} from "@/components/felina/location-fields";
import { Button } from "@/components/ui/button";
import { Checkbox, DateField, SegmentedControl, Select, SwitchRow } from "@/components/ui/controls";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fromDateOnly, toDateOnly } from "@/lib/dates";
import { colonyOptionsQuery } from "@/lib/queries";

export interface CatFormValues {
  photoKey: string | null;
  name: string;
  sex: CatSex;
  birthDate: string;
  birthDateApproximate: boolean;
  sterilized: boolean;
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
  sterilized: false,
  description: "",
  colonyId: null,
  location: emptyLocation,
};

const NO_COLONY = "none";

/** Same fields and validation as the web app's cat form (shared zod schema). */
export function CatForm({
  initial,
  currentPhoto,
  submitLabel,
  onSubmit,
}: {
  initial: CatFormValues;
  /** The cat's photo when editing. */
  currentPhoto?: { catId: string; version: string };
  submitLabel: string;
  onSubmit: (values: CatInput) => Promise<void>;
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
      sterilized: values.sterilized,
      description: values.description,
      colonyId: values.colonyId,
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
      <Field label="Foto principal">
        <PhotoInput
          photoKey={values.photoKey}
          current={currentPhoto}
          onChange={(key) => set("photoKey", key)}
          error={errors.photoKey}
          disabled={submitting}
        />
      </Field>

      <Field label="Nombre" optional error={errors.name}>
        <Input
          value={values.name}
          editable={!submitting}
          onChangeText={(v) => set("name", v)}
          accessibilityLabel="Nombre"
        />
      </Field>

      <Field label="Colonia" error={errors.colonyId}>
        <Select
          value={values.colonyId ?? NO_COLONY}
          items={{ [NO_COLONY]: "Sin colonia", ...colonyLabels(colonies.data) }}
          disabled={submitting}
          onValueChange={(v) => {
            const colonyId = v === NO_COLONY ? null : v;
            set("colonyId", colonyId);
            // A cat joining a colony usually lives there: suggest its location.
            if (colonyId && values.location.latitude === null) {
              applyColonyLocation(colonies.data?.find((c) => c.id === colonyId));
            }
          }}
        />
      </Field>

      <Field label="Sexo" error={errors.sex}>
        <SegmentedControl
          value={values.sex}
          items={CAT_SEX_LABELS}
          onValueChange={(v) => set("sex", v)}
        />
      </Field>

      <Field
        label="Fecha de nacimiento"
        optional
        hint="Déjala vacía si no se conoce."
        error={errors.birthDate}
      >
        {values.birthDate ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between gap-2">
              <DateField
                value={fromDateOnly(values.birthDate)}
                maximumDate={new Date()}
                disabled={submitting}
                onChange={(date) => set("birthDate", toDateOnly(date))}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onPress={() =>
                  setValues((v) => ({ ...v, birthDate: "", birthDateApproximate: false }))
                }
              >
                Quitar
              </Button>
            </View>
            <Checkbox
              label="Es una fecha aproximada"
              value={values.birthDateApproximate}
              disabled={submitting}
              onValueChange={(v) => set("birthDateApproximate", v)}
            />
          </View>
        ) : (
          <Button
            variant="outline"
            icon={CalendarPlus}
            className="self-start"
            disabled={submitting}
            onPress={() => set("birthDate", toDateOnly(new Date()))}
          >
            Indicar fecha
          </Button>
        )}
      </Field>

      <SwitchRow
        label="Castrado"
        description="Se marca automáticamente al completar una acción de castración con este gato."
        value={values.sterilized}
        disabled={submitting}
        onValueChange={(v) => set("sterilized", v)}
      />

      <Field label="Descripción" optional error={errors.description}>
        <Input
          multiline
          value={values.description}
          editable={!submitting}
          onChangeText={(v) => set("description", v)}
          placeholder="Capa, marcas, carácter, estado de salud…"
          accessibilityLabel="Descripción"
        />
      </Field>

      <View className="gap-3">
        {colony ? (
          <Button
            variant="outline"
            size="sm"
            icon={MapPinned}
            className="self-start"
            disabled={submitting}
            onPress={() => applyColonyLocation()}
          >
            {`Usar la ubicación de «${colony.name}»`}
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
      </View>

      <FormError message={formError} />
      {Object.keys(errors).length ? (
        <Text className="text-sm text-negative">Revisa los campos marcados.</Text>
      ) : null}
      <Button loading={submitting} onPress={() => void submit()}>
        {submitLabel}
      </Button>
    </View>
  );
}
