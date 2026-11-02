import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Loader2, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CAT_SEX_LABELS, catDisplayName, type CatSex } from "@felina/domain/felina";
import { PROPOSAL_FIELD_LABELS } from "@felina/client/proposals";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Api, ApiData } from "@felina/api-client";

import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { municipalityQuery } from "@/lib/queries";

import { ProposalStatusBadge } from "./badges";

export type Proposal = ApiData<Api["proposals"]["list"]>[number];

const LABELS = PROPOSAL_FIELD_LABELS;

function MunicipalityName({ code }: { code: string }) {
  const { data } = useQuery(municipalityQuery(code));
  return <>{data ? `${data.name} (${data.provinceName})` : code}</>;
}

function FieldValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground italic">vacío</span>;
  }
  if (typeof value === "boolean") return <>{value ? "Sí" : "No"}</>;
  if (typeof value !== "string" && typeof value !== "number") return <>—</>;
  if (field === "municipalityCode") return <MunicipalityName code={String(value)} />;
  if (field === "sex") return <>{CAT_SEX_LABELS[value as CatSex]}</>;
  if (field === "birthDate") return <>{formatDate(String(value))}</>;
  return <>{value}</>;
}

function ProposalCard({ proposal, canResolve }: { proposal: Proposal; canResolve: boolean }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const refresh = () => queryClient.invalidateQueries();
  const resolve = useMutation({
    mutationFn: (decision: "accept" | "reject") =>
      api().proposals.resolve(proposal.id, { decision, note: note || null }),
    onSuccess: async (_, decision) => {
      toast.success(decision === "accept" ? "Cambios aplicados" : "Propuesta rechazada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: () => api().proposals.withdraw(proposal.id),
    onSuccess: async () => {
      toast.success("Propuesta retirada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const target =
    proposal.targetType === "colony" && proposal.colonyId ? (
      <Link
        to="/colonias/$colonyId"
        params={{ colonyId: proposal.colonyId }}
        className="hover:underline"
      >
        Colonia «{proposal.colonyName}»
      </Link>
    ) : proposal.catId ? (
      <Link to="/gatos/$catId" params={{ catId: proposal.catId }} className="hover:underline">
        Gato «{catDisplayName({ name: proposal.catName })}»
      </Link>
    ) : (
      <span>Elemento eliminado</span>
    );
  const changes = proposal.changes as Record<string, unknown>;
  const previous = proposal.previousValues as Record<string, unknown>;
  const pending = proposal.status === "pending";

  return (
    <li className="surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{target}</p>
          <p className="text-xs text-muted-foreground">
            {proposal.incoming
              ? `Propuesta de ${proposal.proposedByOrganizationName}`
              : `Enviada a ${proposal.targetOrganizationName}`}{" "}
            · {formatDateTime(proposal.createdAt)}
          </p>
        </div>
        <ProposalStatusBadge status={proposal.status} />
      </div>
      {proposal.message ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">«{proposal.message}»</p>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 pr-3 font-medium">Campo</th>
              <th className="py-1 pr-3 font-medium">Antes</th>
              <th className="py-1 font-medium">Propuesto</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(changes).map(([field, value]) => (
              <tr key={field} className="border-t align-top">
                <td className="py-1.5 pr-3 font-medium">{LABELS[field] ?? field}</td>
                <td className="py-1.5 pr-3 text-muted-foreground line-through decoration-muted-foreground/40">
                  <FieldValue field={field} value={previous[field]} />
                </td>
                <td className="py-1.5">
                  <FieldValue field={field} value={value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {proposal.resolutionNote ? (
        <p className="mt-3 text-sm text-muted-foreground">Respuesta: {proposal.resolutionNote}</p>
      ) : null}

      {pending && proposal.incoming && canResolve ? (
        <div className="mt-4 space-y-2">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comentario para el ayuntamiento (opcional)"
            aria-label="Comentario"
            className="bg-card"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => resolve.mutate("accept")} disabled={resolve.isPending}>
              {resolve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Aceptar y aplicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              onClick={() => resolve.mutate("reject")}
              disabled={resolve.isPending}
            >
              <X /> Rechazar
            </Button>
          </div>
        </div>
      ) : null}
      {pending && proposal.incoming && !canResolve ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo los administradores de la asociación pueden aceptarla o rechazarla.
        </p>
      ) : null}
      {pending && !proposal.incoming ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          onClick={() => withdraw.mutate()}
          disabled={withdraw.isPending}
        >
          <Undo2 /> Retirar propuesta
        </Button>
      ) : null}
    </li>
  );
}

export function ProposalList({
  proposals,
  canResolve,
}: {
  proposals: Proposal[];
  canResolve: boolean;
}) {
  return (
    <ul className="grid gap-3">
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} canResolve={canResolve} />
      ))}
    </ul>
  );
}
