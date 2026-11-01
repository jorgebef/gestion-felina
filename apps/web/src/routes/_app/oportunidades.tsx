import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Info, Target, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/app/states";
import { TenderList, Pagination } from "@/components/tenders/TenderList";
import { TrackButton } from "@/components/tenders/TrackButton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { matchesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  profile: z.uuid().optional().catch(undefined),
  view: z.enum(["active", "new", "relevant", "dismissed"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/oportunidades")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(matchesQuery(deps)),
  head: () => ({ meta: [{ title: "Oportunidades · Licita" }] }),
  component: Opportunities,
});

function FeedbackButtons({ matchId, feedback }: { matchId: string; feedback: string | null }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (value: "relevant" | "irrelevant" | null) =>
      api().matches.setFeedback(matchId, value),
    onSuccess: async (_d, value) => {
      if (value === "irrelevant")
        toast.success("Descartada. No la volveremos a enviar por correo.");
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="flex gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Es relevante"
            aria-pressed={feedback === "relevant"}
            disabled={mutation.isPending}
            className={cn(feedback === "relevant" && "bg-positive-soft text-positive")}
            onClick={() => mutation.mutate(feedback === "relevant" ? null : "relevant")}
          >
            <ThumbsUp />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Me interesa</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="No es relevante"
            aria-pressed={feedback === "irrelevant"}
            disabled={mutation.isPending}
            className={cn(feedback === "irrelevant" && "bg-negative-soft text-negative")}
            onClick={() => mutation.mutate(feedback === "irrelevant" ? null : "irrelevant")}
          >
            <ThumbsDown />
          </Button>
        </TooltipTrigger>
        <TooltipContent>No me interesa</TooltipContent>
      </Tooltip>
    </div>
  );
}

function Opportunities() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery(matchesQuery(search));
  const view = search.view ?? "active";

  return (
    <>
      <PageHeader
        title="Oportunidades"
        description="Licitaciones abiertas que encajan con tus perfiles de alertas, ordenadas por relevancia."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={view}
          onValueChange={(v) =>
            void navigate({ search: (s) => ({ ...s, view: v as typeof view, page: undefined }) })
          }
        >
          <TabsList>
            <TabsTrigger value="active">Abiertas</TabsTrigger>
            <TabsTrigger value="new">Nuevas (7 días)</TabsTrigger>
            <TabsTrigger value="relevant">Me interesan</TabsTrigger>
            <TabsTrigger value="dismissed">Descartadas</TabsTrigger>
          </TabsList>
        </Tabs>
        {query.data && query.data.profiles.length > 1 ? (
          <Select
            value={search.profile ?? "all"}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({ ...s, profile: v === "all" ? undefined : v, page: undefined }),
              })
            }
          >
            <SelectTrigger className="w-full bg-card sm:w-64" aria-label="Perfil de alertas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los perfiles</SelectItem>
              {query.data.profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <p className="mb-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        La relevancia (0–100) mide el encaje con tu perfil. No es una probabilidad de adjudicación
        ni confirma que cumplas los requisitos de solvencia; revísalos siempre en los pliegos.
      </p>

      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={Target}
          title={
            view === "dismissed"
              ? "No has descartado ninguna oportunidad"
              : "Sin oportunidades en esta vista"
          }
          description={
            view === "active"
              ? "Cuando se publiquen licitaciones que encajen con tus perfiles aparecerán aquí."
              : undefined
          }
          action={
            view === "active" ? (
              <Button asChild variant="outline">
                <Link to="/alertas">Ajustar perfiles</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <TenderList
            showScore
            rows={query.data.items.map((m) => ({
              id: m.tenderId,
              title: m.title,
              authorityName: m.authorityName,
              status: m.status,
              contractType: m.contractType,
              executionProvinces: m.executionProvinces,
              baseBudgetExVatEur: m.baseBudgetExVatEur,
              submissionDeadlineAt: m.submissionDeadlineAt,
              firstPublishedAt: m.firstPublishedAt,
              score: m.score,
              trackedStatus: m.trackedStatus,
              note: (
                <ul className="space-y-0.5">
                  <li className="font-medium text-foreground/70">{m.profileName}</li>
                  {(m.matchReason ?? "")
                    .split("\n")
                    .slice(0, 2)
                    .map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                </ul>
              ),
              actions: (
                <div className="flex items-center justify-end gap-1">
                  <FeedbackButtons matchId={m.matchId} feedback={m.feedback} />
                  <TrackButton tenderId={m.tenderId} tracked={Boolean(m.trackedStatus)} />
                </div>
              ),
            }))}
          />
          <Pagination
            page={query.data.page}
            pageCount={query.data.pageCount}
            total={query.data.total}
            renderLink={(page, label, disabled) => (
              <Button
                asChild={!disabled}
                variant="outline"
                size="sm"
                disabled={disabled}
                className="bg-card"
              >
                {disabled ? (
                  <span>{label}</span>
                ) : (
                  <Link from={Route.fullPath} search={(s) => ({ ...s, page })}>
                    {label}
                  </Link>
                )}
              </Button>
            )}
          />
        </>
      )}
    </>
  );
}
