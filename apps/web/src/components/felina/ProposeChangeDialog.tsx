import { useQueryClient } from "@tanstack/react-query";
import { GitPullRequestArrow, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CAT_SEXES, CAT_SEX_LABELS, type CatSex } from "@felina/domain/felina";
import { catChangesSchema, colonyChangesSchema } from "@felina/schemas/proposal";

import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";

import { MunicipalityPicker, type MunicipalityValue } from "./MunicipalityPicker";

interface Common {
  name: string | null;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  municipalityCode: string;
  municipalityName: string;
}

export type ProposalTarget =
  | { type: "colony"; id: string; current: Common & { name: string } }
  | {
      type: "cat";
      id: string;
      current: Common & { sex: CatSex; birthDate: string | null; birthDateApproximate: boolean };
    };

type Draft = Record<string, unknown>;

/** Text value of a draft field (strings and numbers; anything else is empty). */
function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function initialDraft(target: ProposalTarget): Draft {
  const c = target.current;
  return {
    name: c.name ?? "",
    description: c.description ?? "",
    address: c.address ?? "",
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    municipality: { code: c.municipalityCode, name: c.municipalityName } as MunicipalityValue,
    ...(target.type === "cat"
      ? {
          sex: target.current.sex,
          birthDate: target.current.birthDate ?? "",
          birthDateApproximate: target.current.birthDateApproximate,
        }
      : {}),
  };
}

/** Only fields that differ from the current values are sent. */
function changesFrom(target: ProposalTarget, draft: Draft): Record<string, unknown> {
  const c = target.current as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const text = (key: string) => {
    const value = str(draft[key]).trim();
    const normalized = value || null;
    if (normalized !== (c[key] ?? null)) out[key] = normalized;
  };
  text("name");
  text("description");
  text("address");
  const lat = Number(draft.latitude);
  const lng = Number(draft.longitude);
  if (lat !== c.latitude || lng !== c.longitude) {
    out.latitude = lat;
    out.longitude = lng;
  }
  const municipality = draft.municipality as MunicipalityValue | null;
  if (municipality && municipality.code !== c.municipalityCode)
    out.municipalityCode = municipality.code;
  if (target.type === "cat") {
    if (draft.sex !== c.sex) out.sex = draft.sex;
    const birthDate = str(draft.birthDate) || null;
    if (birthDate !== (c.birthDate ?? null)) out.birthDate = birthDate;
    if (draft.birthDateApproximate !== c.birthDateApproximate) {
      out.birthDateApproximate = draft.birthDateApproximate;
    }
  }
  return out;
}

/** Town halls propose changes; the managing association decides. */
export function ProposeChangeDialog({ target }: { target: ProposalTarget }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(target));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();
  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    const changes = changesFrom(target, draft);
    if (!Object.keys(changes).length) {
      setError("Cambia al menos un dato antes de enviar la propuesta.");
      return;
    }
    const schema = target.type === "colony" ? colonyChangesSchema : catChangesSchema;
    const parsed = schema.safeParse(changes);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const body = { changes: parsed.data, message: message.trim() || null };
      if (target.type === "colony") await api().colonies.propose(target.id, body as never);
      else await api().cats.propose(target.id, body as never);
      toast.success("Propuesta enviada a la asociación gestora");
      setOpen(false);
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const text = (key: string, label: string, multiline = false) => (
    <Field id={`p-${key}`} label={label}>
      {multiline ? (
        <Textarea
          id={`p-${key}`}
          rows={2}
          value={str(draft[key])}
          onChange={(e) => set(key, e.target.value)}
          className="bg-card"
        />
      ) : (
        <Input
          id={`p-${key}`}
          value={str(draft[key])}
          onChange={(e) => set(key, e.target.value)}
          className="bg-card"
        />
      )}
    </Field>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(initialDraft(target));
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-card">
          <GitPullRequestArrow /> Proponer cambio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Proponer un cambio</DialogTitle>
          <DialogDescription>
            Modifica los datos que quieras corregir. No se aplican hasta que la asociación gestora
            acepte la propuesta.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {text("name", "Nombre")}
          {target.type === "cat" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-sex" label="Sexo">
                <Select value={String(draft.sex)} onValueChange={(v) => set("sex", v)}>
                  <SelectTrigger id="p-sex" className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAT_SEXES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CAT_SEX_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="p-birthDate" label="Fecha de nacimiento">
                <Input
                  id="p-birthDate"
                  type="date"
                  value={str(draft.birthDate)}
                  onChange={(e) => set("birthDate", e.target.value)}
                  className="bg-card"
                />
              </Field>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="p-approx"
                  checked={Boolean(draft.birthDateApproximate)}
                  onCheckedChange={(v) => set("birthDateApproximate", v === true)}
                />
                <Label htmlFor="p-approx" className="font-normal">
                  La fecha es aproximada
                </Label>
              </div>
            </div>
          ) : null}
          {text("description", "Descripción", true)}
          {text("address", "Dirección")}
          <Field id="p-municipality" label="Municipio">
            <MunicipalityPicker
              id="p-municipality"
              value={draft.municipality as MunicipalityValue}
              onChange={(m) => set("municipality", m)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("latitude", "Latitud")}
            {text("longitude", "Longitud")}
          </div>
          <Field id="p-message" label="Mensaje para la asociación" optional>
            <Textarea
              id="p-message"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-card"
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : null}
              Enviar propuesta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
