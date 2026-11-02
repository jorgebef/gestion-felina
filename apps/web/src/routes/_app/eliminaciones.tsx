import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Trash2, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { Api, ApiData } from "@felina/api-client";
import { DELETION_STATUSES, DELETION_TARGET_LABELS } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { CardsSkeleton } from "@/components/app/skeletons";
import { DeletionStatusBadge } from "@/components/felina/badges";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { deletionRequestsQuery } from "@/lib/queries";

type DeletionRequest = ApiData<Api["deletions"]["list"]>[number];

export const Route = createFileRoute("/_app/eliminaciones")({
  validateSearch: z.object({
    status: z
      .enum([...DELETION_STATUSES, "all"])
      .optional()
      .catch(undefined),
  }),
  head: () => ({ meta: [{ title: `Eliminaciones · ${APP_NAME}` }] }),
  component: Deletions,
});

function Deletions() {
  const { membership } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const status = search.status ?? "pending";
  const query = useQuery(deletionRequestsQuery({ status: status === "all" ? undefined : status }));
  const isAdmin = membership.role === "admin";

  return (
    <>
      <PageHeader
        title="Solicitudes de eliminación"
        description={
          isAdmin
            ? "Colonias, gatos y acciones que el equipo pide eliminar. No se eliminan hasta que las apruebes."
            : "Solo los administradores eliminan colonias, gatos y acciones; aquí ves lo que se ha pedido eliminar."
        }
      />
      <Tabs
        value={status}
        onValueChange={(v) => navigate({ search: { status: v as typeof status } })}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="approved">Aprobadas</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.isPending || query.isFetching ? (
        <CardsSkeleton cards={3} className="max-w-3xl space-y-3" label="Cargando solicitudes…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length ? (
        <ul className="grid max-w-3xl gap-3">
          {query.data.map((r) => (
            <DeletionRequestCard key={r.id} request={r} canResolve={isAdmin} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Trash2}
          title="No hay solicitudes"
          description="Cuando alguien pida eliminar una colonia, un gato o una acción, aparecerá aquí."
        />
      )}
    </>
  );
}

function TargetLink({ request }: { request: DeletionRequest }) {
  const label = `${DELETION_TARGET_LABELS[request.targetType]} «${request.targetLabel}»`;
  if (request.colonyId) {
    return (
      <Link
        to="/colonias/$colonyId"
        params={{ colonyId: request.colonyId }}
        className="hover:underline"
      >
        {label}
      </Link>
    );
  }
  if (request.catId) {
    return (
      <Link to="/gatos/$catId" params={{ catId: request.catId }} className="hover:underline">
        {label}
      </Link>
    );
  }
  if (request.actionId) {
    return (
      <Link
        to="/acciones/$actionId"
        params={{ actionId: request.actionId }}
        className="hover:underline"
      >
        {label}
      </Link>
    );
  }
  return <span>{label}</span>;
}

function DeletionRequestCard({
  request,
  canResolve,
}: {
  request: DeletionRequest;
  canResolve: boolean;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const refresh = () => queryClient.invalidateQueries();
  const resolve = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      api().deletions.resolve(request.id, { decision, note: note.trim() || null }),
    onSuccess: async (_, decision) => {
      toast.success(decision === "approve" ? "Eliminado" : "Solicitud rechazada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: () => api().deletions.withdraw(request.id),
    onSuccess: async () => {
      toast.success("Solicitud retirada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const pending = request.status === "pending";

  return (
    <li className="surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            <TargetLink request={request} />
          </p>
          <p className="text-xs text-muted-foreground">
            Pedida por{" "}
            {request.mine ? "ti" : (request.requestedByName ?? "una persona que ya no está")} ·{" "}
            {formatDateTime(request.createdAt)}
          </p>
        </div>
        <DeletionStatusBadge status={request.status} />
      </div>
      {request.reason ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">«{request.reason}»</p>
      ) : null}
      {request.resolvedAt ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {request.status === "approved" ? "Aprobada" : "Rechazada"}
          {request.resolvedByName ? ` por ${request.resolvedByName}` : ""} el{" "}
          {formatDateTime(request.resolvedAt)}
          {request.resolutionNote ? `: «${request.resolutionNote}»` : "."}
        </p>
      ) : null}

      {pending && canResolve ? (
        <div className="mt-4 space-y-2">
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
                  <AlertDialogTitle>¿Eliminar «{request.targetLabel}»?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se aprueba la solicitud y se elimina definitivamente. No se puede deshacer.
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
      ) : null}
      {pending && !canResolve && request.mine ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          onClick={() => withdraw.mutate()}
          disabled={withdraw.isPending}
        >
          {withdraw.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
          Retirar solicitud
        </Button>
      ) : null}
    </li>
  );
}
