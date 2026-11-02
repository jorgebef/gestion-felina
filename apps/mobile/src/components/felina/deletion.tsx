/**
 * Deleting colonies, cats and actions (the web app's Deletion.tsx). Association admins
 * delete directly; anyone else who can edit the item asks for its deletion, and it stays
 * until an admin approves it.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Check, Trash2, Undo2, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { toast } from "sonner-native";

import type { Api, ApiData } from "@felina/api-client";
import { errorMessage } from "@felina/client/errors";
import { formatDateTime } from "@felina/client/format";
import { DELETION_TARGET_LABELS, type DeletionTarget } from "@felina/domain/felina";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SafeAreaView } from "@/components/ui/safe-area";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";

import { DeletionStatusBadge } from "./badges";
import { EntityAvatar, EntityLabel } from "./entity-avatar";

export interface DeletionTargetRef {
  type: DeletionTarget;
  id: string;
  name: string;
}

export interface PendingDeletion {
  id: string;
  reason: string | null;
  createdAt: string;
  requestedById: string | null;
  requestedByName: string | null;
  requestedByAvatar: string | null;
  requestedByMe: boolean;
}

export interface DeletionPermissions {
  canDelete: boolean;
  canRequestDeletion: boolean;
  canResolveDeletion: boolean;
}

const NOUN: Record<DeletionTarget, string> = {
  colony: "la colonia",
  cat: "el gato",
  action: "la acción",
};

/** Admins delete (after confirming); others ask for it. Nothing while a request is open. */
export function DeleteOrRequestButton({
  target,
  permissions,
  pendingDeletion,
  consequences,
  onDelete,
  deleting,
}: {
  target: DeletionTargetRef;
  permissions: DeletionPermissions;
  pendingDeletion: PendingDeletion | null;
  consequences: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  if (permissions.canDelete) {
    return (
      <Button
        variant="ghost"
        tone="negative"
        icon={Trash2}
        loading={deleting}
        onPress={async () => {
          const ok = await confirm({
            title: `¿Eliminar «${target.name}»?`,
            message: `${consequences} No se puede deshacer.`,
            confirmLabel: "Eliminar",
          });
          if (ok) onDelete();
        }}
      >
        Eliminar
      </Button>
    );
  }
  if (permissions.canRequestDeletion && !pendingDeletion) {
    return <RequestDeletionSheet target={target} consequences={consequences} />;
  }
  return null;
}

function RequestDeletionSheet({
  target,
  consequences,
}: {
  target: DeletionTargetRef;
  consequences: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: () =>
      api().deletions.request({
        targetType: target.type,
        targetId: target.id,
        reason: reason.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Solicitud enviada", {
        description: "Un administrador de la asociación debe aprobar la eliminación.",
      });
      setOpen(false);
      setReason("");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <Button variant="ghost" tone="negative" icon={Trash2} onPress={() => setOpen(true)}>
        Solicitar eliminación
      </Button>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
              <Text className="flex-1 text-lg font-semibold text-foreground" numberOfLines={1}>
                Solicitar eliminación
              </Text>
              <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                Cancelar
              </Button>
            </View>
            <ScrollView
              contentContainerClassName="gap-4 px-4 pb-10"
              keyboardShouldPersistTaps="handled"
            >
              <Text className="text-sm text-muted-foreground">
                Solo los administradores de la asociación eliminan. Se eliminará {NOUN[target.type]}{" "}
                «{target.name}» cuando una persona administradora lo apruebe. {consequences}
              </Text>
              <Field label="Motivo" optional>
                <Input
                  multiline
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Por qué hay que eliminarlo"
                  accessibilityLabel="Motivo"
                  className="min-h-20"
                />
              </Field>
              <Button
                variant="destructive"
                loading={request.isPending}
                onPress={() => request.mutate()}
              >
                Enviar solicitud
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

/** Approve/reject (admins) or withdraw (whoever asked) a pending request. */
function useDeletionActions(requestId: string, onApproved?: () => void) {
  const queryClient = useQueryClient();
  const resolve = useMutation({
    mutationFn: ({ decision, note }: { decision: "approve" | "reject"; note: string }) =>
      api().deletions.resolve(requestId, { decision, note: note.trim() || null }),
    onSuccess: async (_, { decision }) => {
      toast.success(decision === "approve" ? "Eliminado" : "Solicitud rechazada");
      if (decision === "approve") onApproved?.();
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: () => api().deletions.withdraw(requestId),
    onSuccess: async () => {
      toast.success("Solicitud retirada");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return { resolve, withdraw };
}

function ResolveControls({
  name,
  resolve,
}: {
  name: string;
  resolve: ReturnType<typeof useDeletionActions>["resolve"];
}) {
  const [note, setNote] = useState("");
  return (
    <View className="gap-2">
      <Input
        multiline
        value={note}
        onChangeText={setNote}
        placeholder="Comentario para quien lo pidió (opcional)"
        accessibilityLabel="Comentario"
        className="min-h-16"
      />
      <View className="flex-row flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive"
          icon={Check}
          loading={resolve.isPending && resolve.variables?.decision === "approve"}
          disabled={resolve.isPending}
          onPress={async () => {
            const ok = await confirm({
              title: `¿Eliminar «${name}»?`,
              message: "Se aprueba la solicitud y se elimina definitivamente.",
              confirmLabel: "Eliminar",
            });
            if (ok) resolve.mutate({ decision: "approve", note });
          }}
        >
          Aprobar y eliminar
        </Button>
        <Button
          size="sm"
          variant="outline"
          icon={X}
          loading={resolve.isPending && resolve.variables?.decision === "reject"}
          disabled={resolve.isPending}
          onPress={() => resolve.mutate({ decision: "reject", note })}
        >
          Rechazar
        </Button>
      </View>
    </View>
  );
}

/** Banner of a pending deletion request on a colony, cat or action screen. */
export function PendingDeletionNotice({
  target,
  pending,
  canResolve,
  onApproved,
}: {
  target: DeletionTargetRef;
  pending: PendingDeletion | null;
  canResolve: boolean;
  onApproved: () => void;
}) {
  const { resolve, withdraw } = useDeletionActions(pending?.id ?? "", onApproved);
  if (!pending) return null;
  return (
    <View className="gap-2 rounded-xl border border-warning/30 bg-warning-soft p-4">
      <Text className="text-sm font-semibold text-warning">
        Eliminación pendiente de aprobación
      </Text>
      <View className="flex-row flex-wrap items-center gap-1">
        <Text className="text-sm text-foreground">Pedida por</Text>
        <EntityLabel
          entity={{ kind: "user", id: pending.requestedById, avatar: pending.requestedByAvatar }}
          name={pending.requestedByMe ? "ti" : (pending.requestedByName ?? "alguien")}
        />
        <Text className="text-sm text-foreground">el {formatDateTime(pending.createdAt)}.</Text>
      </View>
      {pending.reason ? (
        <Text className="text-sm text-foreground">Motivo: «{pending.reason}»</Text>
      ) : null}
      {canResolve ? (
        <ResolveControls name={target.name} resolve={resolve} />
      ) : pending.requestedByMe ? (
        <Button
          size="sm"
          variant="ghost"
          icon={Undo2}
          className="self-start"
          loading={withdraw.isPending}
          onPress={() => withdraw.mutate()}
        >
          Retirar solicitud
        </Button>
      ) : (
        <Text className="text-xs text-muted-foreground">
          Un administrador de la asociación debe aprobarla o rechazarla.
        </Text>
      )}
    </View>
  );
}

export type DeletionRequest = ApiData<Api["deletions"]["list"]>[number];

function targetHref(r: DeletionRequest) {
  if (r.colonyId) return `/colonias/${r.colonyId}` as const;
  if (r.catId) return `/gatos/${r.catId}` as const;
  if (r.actionId) return `/acciones/${r.actionId}` as const;
  return null;
}

/** One request in the "Eliminaciones" screen. */
export function DeletionRequestCard({
  request,
  canResolve,
}: {
  request: DeletionRequest;
  canResolve: boolean;
}) {
  const { resolve, withdraw } = useDeletionActions(request.id);
  const href = targetHref(request);
  const label = `${DELETION_TARGET_LABELS[request.targetType]} «${request.targetLabel}»`;
  const pending = request.status === "pending";

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            {request.targetType === "cat" ? (
              <EntityAvatar
                entity={{ kind: "cat", id: request.catId }}
                name={request.targetLabel}
              />
            ) : null}
            {href ? (
              <Link href={href} className="shrink text-base font-medium text-foreground">
                {label}
              </Link>
            ) : (
              <Text className="shrink text-base font-medium text-foreground">{label}</Text>
            )}
          </View>
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-xs text-muted-foreground">Pedida por</Text>
            <EntityLabel
              entity={{
                kind: "user",
                id: request.requestedById,
                avatar: request.requestedByAvatar,
              }}
              name={request.mine ? "ti" : (request.requestedByName ?? "una persona que ya no está")}
              textClassName="text-xs text-muted-foreground"
            />
            <Text className="text-xs text-muted-foreground">
              · {formatDateTime(request.createdAt)}
            </Text>
          </View>
        </View>
        <DeletionStatusBadge status={request.status} />
      </View>
      {request.reason ? (
        <Text className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          «{request.reason}»
        </Text>
      ) : null}
      {request.resolvedAt ? (
        <View className="flex-row flex-wrap items-center gap-1">
          <Text className="text-sm text-muted-foreground">
            {request.status === "approved" ? "Aprobada" : "Rechazada"}
            {request.resolvedByName ? " por" : ""}
          </Text>
          {request.resolvedByName ? (
            <EntityLabel
              entity={{ kind: "user", id: request.resolvedBy, avatar: request.resolvedByAvatar }}
              name={request.resolvedByName}
              textClassName="text-sm text-muted-foreground"
            />
          ) : null}
          <Text className="text-sm text-muted-foreground">
            el {formatDateTime(request.resolvedAt)}
            {request.resolutionNote ? `: «${request.resolutionNote}»` : "."}
          </Text>
        </View>
      ) : null}
      {pending && canResolve ? (
        <ResolveControls name={request.targetLabel} resolve={resolve} />
      ) : null}
      {pending && !canResolve && request.mine ? (
        <Button
          size="sm"
          variant="ghost"
          icon={Undo2}
          className="self-start"
          loading={withdraw.isPending}
          onPress={() => withdraw.mutate()}
        >
          Retirar solicitud
        </Button>
      ) : null}
    </Card>
  );
}
