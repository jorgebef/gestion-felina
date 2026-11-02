/**
 * Deleting colonies, cats and actions. Association admins delete directly; anyone else
 * who can edit the item asks for its deletion, and it stays until an admin approves it.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Trash2, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { DeletionTarget } from "@felina/domain/felina";

import { Field } from "@/components/forms/Field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

export interface DeletionTargetRef {
  type: DeletionTarget;
  id: string;
  /** e.g. «Parque del Oeste», for the dialogs. */
  name: string;
}

export interface PendingDeletion {
  id: string;
  reason: string | null;
  createdAt: string;
  requestedByName: string | null;
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

/**
 * The header's delete button: admins delete (after confirming), others ask for it.
 * Nothing while a request is pending (the notice below the header handles it).
 */
export function DeleteOrRequestButton({
  target,
  permissions,
  pendingDeletion,
  consequences,
  onDelete,
}: {
  target: DeletionTargetRef;
  permissions: DeletionPermissions;
  pendingDeletion: PendingDeletion | null;
  /** What deleting implies, shown when confirming. */
  consequences: string;
  onDelete: () => void;
}) {
  if (permissions.canDelete) {
    return (
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost" className="text-negative hover:text-negative" />}
        >
          <Trash2 /> Eliminar
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{target.name}»?</AlertDialogTitle>
            <AlertDialogDescription>{consequences} No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  if (permissions.canRequestDeletion && !pendingDeletion) {
    return <RequestDeletionDialog target={target} consequences={consequences} />;
  }
  return null;
}

function RequestDeletionDialog({
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" className="text-negative hover:text-negative" />}
      >
        <Trash2 /> Solicitar eliminación
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar eliminar «{target.name}»</DialogTitle>
          <DialogDescription>
            Solo los administradores de la asociación eliminan. Se eliminará {NOUN[target.type]}{" "}
            cuando una persona administradora lo apruebe. {consequences}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <Field id="deletion-reason" label="Motivo" optional>
            <Textarea
              id="deletion-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por qué hay que eliminarlo"
              className="bg-card"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={request.isPending}>
              {request.isPending ? <Loader2 className="animate-spin" /> : null}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Banner of a pending deletion request. Admins approve (the item is deleted, then
 * `onApproved` leaves the page) or reject it; whoever asked can withdraw it.
 */
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
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      api().deletions.resolve(pending!.id, { decision, note: note.trim() || null }),
    onSuccess: async (_, decision) => {
      if (decision === "approve") {
        toast.success("Eliminación aprobada");
        onApproved();
        // After leaving: refetching this item now would only find it gone.
        await queryClient.invalidateQueries();
        return;
      }
      toast.success("Solicitud rechazada");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: () => api().deletions.withdraw(pending!.id),
    onSuccess: async () => {
      toast.success("Solicitud retirada");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!pending) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm"
    >
      <p className="font-medium text-warning">
        Eliminación pendiente de aprobación
        <span className="font-normal text-foreground">
          {" "}
          · pedida por {pending.requestedByMe
            ? "ti"
            : (pending.requestedByName ?? "alguien")} el{" "}
          {formatDateTime(pending.createdAt)}
        </span>
      </p>
      {pending.reason ? <p className="mt-1">Motivo: «{pending.reason}»</p> : null}

      {canResolve ? (
        <div className="mt-3 space-y-2">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comentario para quien lo pidió (opcional)"
            aria-label="Comentario"
            className="bg-card"
          />
          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button size="sm" variant="destructive" disabled={resolve.isPending} />}
              >
                {resolve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Aprobar y eliminar
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar «{target.name}»?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se aprueba la solicitud y se elimina {NOUN[target.type]}. No se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resolve.mutate("approve")}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
      ) : pending.requestedByMe ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() => withdraw.mutate()}
          disabled={withdraw.isPending}
        >
          {withdraw.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
          Retirar solicitud
        </Button>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Un administrador de la asociación debe aprobarla o rechazarla.
        </p>
      )}
    </div>
  );
}
