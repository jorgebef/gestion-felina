import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Newspaper, Undo2 } from "lucide-react-native";
import { useState } from "react";
import { Text } from "react-native";
import { toast } from "sonner-native";

import { errorMessage } from "@felina/client/errors";
import { formatDateTime } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { RowsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState } from "@/components/app/states";
import { ActionRow, type ActionSummary } from "@/components/felina/action-row";
import { Pager } from "@/components/felina/pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { actionsQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

const VALIDATION = { pending: "Sin validar", validated: "Validadas", all: "Todas" } as const;

function ValidateButton({ action }: { action: ActionSummary }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (validated: boolean) => api().actions.setValidation(action.id, validated),
    onSuccess: async (_, validated) => {
      toast.success(validated ? "Acción validada" : "Validación retirada");
      await queryClient.invalidateQueries({ queryKey: ["actions"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return action.validatedAt && !action.modifiedAfterValidation ? (
    <Button
      size="sm"
      variant="ghost"
      icon={Undo2}
      loading={mutation.isPending}
      onPress={() => mutation.mutate(false)}
    >
      Dejar sin validar
    </Button>
  ) : (
    <Button
      size="sm"
      icon={BadgeCheck}
      loading={mutation.isPending}
      onPress={() => mutation.mutate(true)}
    >
      {action.validatedAt ? "Validar de nuevo" : "Validar"}
    </Button>
  );
}

/** Town halls: every action in their municipality, newest first, to validate. */
export function FeedScreen() {
  const { organization } = useMembership();
  const [validation, setValidation] = useState<keyof typeof VALIDATION>("pending");
  const [page, setPage] = useState(1);
  const query = useQuery(
    actionsQuery({
      view: "feed",
      validation: validation === "all" ? undefined : validation,
      page,
    }),
  );

  return (
    <Screen onRefresh={query.refetch}>
      <Text className="text-sm text-muted-foreground">
        Acciones de las asociaciones en {organization.municipalityName ?? "tu municipio"}. Valídalas
        o déjalas sin validar.
      </Text>
      <SegmentedControl
        value={validation}
        items={VALIDATION}
        onValueChange={(v) => {
          setValidation(v);
          setPage(1);
        }}
      />
      {query.isPending || query.isFetching ? (
        <RowsSkeleton badges label="Cargando acciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length ? (
        <>
          <Card>
            {query.data.items.map((a, i) => (
              <ActionRow
                key={a.id}
                action={a}
                first={i === 0}
                showOrganization
                footer={`Registrada ${formatDateTime(a.createdAt)}${
                  a.description
                    ? ` · ${a.description.slice(0, 140)}${a.description.length > 140 ? "…" : ""}`
                    : ""
                }`}
                trailing={<ValidateButton action={a} />}
              />
            ))}
          </Card>
          <Pager
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPage={setPage}
          />
        </>
      ) : (
        <EmptyState
          icon={Newspaper}
          title={
            validation === "pending" ? "No hay acciones pendientes de validar" : "No hay acciones"
          }
          description="Cuando una asociación registre una acción en tu municipio, aparecerá aquí."
        />
      )}
    </Screen>
  );
}
