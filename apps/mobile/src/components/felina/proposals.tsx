import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Check, Undo2, X } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import type { Api, ApiData } from "@felina/api-client";
import { CAT_SEX_LABELS, catDisplayName, type CatSex } from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";
import { formatDate, formatDateTime } from "@felina/client/format";
import { PROPOSAL_FIELD_LABELS } from "@felina/client/proposals";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { municipalityQuery } from "@/lib/queries";

import { ProposalStatusBadge } from "./badges";

export type Proposal = ApiData<Api["proposals"]["list"]>[number];

function MunicipalityName({ code, className }: { code: string; className: string }) {
  const { data } = useQuery(municipalityQuery(code));
  return <Text className={className}>{data ? `${data.name} (${data.provinceName})` : code}</Text>;
}

function FieldValue({ field, value, before }: { field: string; value: unknown; before?: boolean }) {
  const className = before
    ? "text-sm text-muted-foreground line-through"
    : "text-sm text-foreground";
  if (value === null || value === undefined || value === "") {
    return <Text className="text-sm text-muted-foreground italic">vacío</Text>;
  }
  if (typeof value === "boolean") return <Text className={className}>{value ? "Sí" : "No"}</Text>;
  if (typeof value !== "string" && typeof value !== "number") {
    return <Text className={className}>—</Text>;
  }
  if (field === "municipalityCode")
    return <MunicipalityName code={String(value)} className={className} />;
  const text =
    field === "sex"
      ? CAT_SEX_LABELS[value as CatSex]
      : field === "birthDate"
        ? formatDate(String(value))
        : String(value);
  return <Text className={className}>{text}</Text>;
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

  const changes = proposal.changes as Record<string, unknown>;
  const previous = proposal.previousValues as Record<string, unknown>;
  const pending = proposal.status === "pending";
  const href =
    proposal.targetType === "colony" && proposal.colonyId
      ? (`/colonias/${proposal.colonyId}` as const)
      : proposal.catId
        ? (`/gatos/${proposal.catId}` as const)
        : null;
  const label =
    proposal.targetType === "colony" && proposal.colonyId
      ? `Colonia «${proposal.colonyName}»`
      : proposal.catId
        ? `Gato «${catDisplayName({ name: proposal.catName })}»`
        : "Elemento eliminado";

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          {href ? (
            <Link href={href} className="text-base font-medium text-foreground">
              {label}
            </Link>
          ) : (
            <Text className="text-base font-medium text-foreground">{label}</Text>
          )}
          <Text className="text-xs text-muted-foreground">
            {proposal.incoming
              ? `Propuesta de ${proposal.proposedByOrganizationName}`
              : `Enviada a ${proposal.targetOrganizationName}`}{" "}
            · {formatDateTime(proposal.createdAt)}
          </Text>
        </View>
        <ProposalStatusBadge status={proposal.status} />
      </View>
      {proposal.message ? (
        <Text className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          «{proposal.message}»
        </Text>
      ) : null}
      <View>
        {Object.entries(changes).map(([field, value]) => (
          <View key={field} className="gap-1 border-t border-border py-2">
            <Text className="text-xs font-medium text-muted-foreground">
              {PROPOSAL_FIELD_LABELS[field] ?? field}
            </Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <FieldValue field={field} value={previous[field]} before />
              <Text className="text-sm text-muted-foreground">→</Text>
              <FieldValue field={field} value={value} />
            </View>
          </View>
        ))}
      </View>
      {proposal.resolutionNote ? (
        <Text className="text-sm text-muted-foreground">Respuesta: {proposal.resolutionNote}</Text>
      ) : null}

      {pending && proposal.incoming && canResolve ? (
        <View className="gap-2">
          <Input
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Comentario para el ayuntamiento (opcional)"
            accessibilityLabel="Comentario"
            className="min-h-16"
          />
          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              icon={Check}
              loading={resolve.isPending && resolve.variables === "accept"}
              disabled={resolve.isPending}
              onPress={() => resolve.mutate("accept")}
            >
              Aceptar y aplicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={X}
              loading={resolve.isPending && resolve.variables === "reject"}
              disabled={resolve.isPending}
              onPress={() => resolve.mutate("reject")}
            >
              Rechazar
            </Button>
          </View>
        </View>
      ) : null}
      {pending && proposal.incoming && !canResolve ? (
        <Text className="text-xs text-muted-foreground">
          Solo los administradores de la asociación pueden aceptarla o rechazarla.
        </Text>
      ) : null}
      {pending && !proposal.incoming ? (
        <Button
          size="sm"
          variant="ghost"
          icon={Undo2}
          className="self-start"
          loading={withdraw.isPending}
          onPress={() => withdraw.mutate()}
        >
          Retirar propuesta
        </Button>
      ) : null}
    </Card>
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
    <View className="gap-3">
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} canResolve={canResolve} />
      ))}
    </View>
  );
}
