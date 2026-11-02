import { useQuery } from "@tanstack/react-query";
import { Link, Stack, type Href } from "expo-router";
import {
  CalendarCheck,
  Cat,
  GitPullRequestArrow,
  MapPinned,
  Newspaper,
  Plus,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { formatInteger, pluralize } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { RowsSkeleton } from "@/components/app/skeletons";
import { EmptyState, ErrorState, PageHeader, SectionTitle } from "@/components/app/states";
import { ActionRow } from "@/components/felina/action-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

function Stat({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: number | undefined;
  detail?: string;
  href: Href;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" className="w-[48.5%] active:opacity-80">
        <Card className="gap-1 p-4">
          <Text className="text-sm text-muted-foreground">{label}</Text>
          {value === undefined ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <Text className="text-3xl font-semibold tracking-tight text-foreground">
              {formatInteger(value)}
            </Text>
          )}
          {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
        </Card>
      </Pressable>
    </Link>
  );
}

export default function Dashboard() {
  const { organization, isTownHall, isAdmin } = useMembership();
  const query = useQuery(dashboardQuery);
  const data = query.data;
  const loading = query.isPending || query.isFetching;

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen
        options={{
          headerRight: isTownHall
            ? undefined
            : () => (
                <Link href="/acciones/nueva" asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    icon={Plus}
                    accessibilityLabel="Nueva acción"
                  />
                </Link>
              ),
        }}
      />
      <PageHeader
        eyebrow={
          isTownHall ? `Ayuntamiento · ${organization.municipalityName ?? ""}` : "Asociación"
        }
        title={organization.name}
      />

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <Stat
            label={isTownHall ? "Colonias en el municipio" : "Colonias"}
            value={data?.colonies.total}
            detail={
              data ? pluralize(data.colonies.authorized, "autorizada", "autorizadas") : undefined
            }
            href="/colonias"
          />
          <Stat
            label="Gatos"
            value={data?.cats.total}
            detail={data ? pluralize(data.cats.sterilized, "castrado", "castrados") : undefined}
            href="/gatos"
          />
          {isTownHall ? (
            <Stat
              label="Acciones sin validar"
              value={data?.actions.pendingValidation}
              detail={
                data
                  ? `${pluralize(data.actions.doneThisYear, "realizada", "realizadas")} este año`
                  : undefined
              }
              href="/acciones"
            />
          ) : (
            <Stat
              label="Acciones abiertas"
              value={data?.actions.open}
              detail={data ? pluralize(data.actions.urgentOpen, "urgente", "urgentes") : undefined}
              href="/acciones"
            />
          )}
          <Stat
            label={isTownHall ? "Propuestas pendientes" : "Propuestas por revisar"}
            value={data?.pendingProposals}
            detail={isTownHall ? "Enviadas a asociaciones" : "Del ayuntamiento"}
            href="/propuestas"
          />
        </View>
      )}

      <View className="gap-3">
        <SectionTitle icon={CalendarCheck}>Próximas acciones</SectionTitle>
        {loading ? (
          <RowsSkeleton badges rows={3} label="Cargando acciones…" />
        ) : data?.upcoming.length ? (
          <Card>
            {data.upcoming.map((a, i) => (
              <ActionRow key={a.id} action={a} showOrganization={isTownHall} first={i === 0} />
            ))}
          </Card>
        ) : data ? (
          <EmptyState
            icon={CalendarCheck}
            title="No hay acciones programadas"
            action={
              !isTownHall ? (
                <Link href="/acciones/nueva" asChild>
                  <Button size="sm">Planificar una acción</Button>
                </Link>
              ) : undefined
            }
          />
        ) : null}
      </View>

      <View className="gap-3">
        <SectionTitle icon={isTownHall ? Newspaper : GitPullRequestArrow}>
          {isTownHall ? "Pendientes de validar" : "Validadas recientemente"}
        </SectionTitle>
        {loading ? (
          <RowsSkeleton badges rows={3} label="Cargando acciones…" />
        ) : data?.recent.length ? (
          <Card>
            {data.recent.map((a, i) => (
              <ActionRow key={a.id} action={a} showOrganization={isTownHall} first={i === 0} />
            ))}
          </Card>
        ) : data ? (
          <EmptyState
            icon={isTownHall ? Newspaper : GitPullRequestArrow}
            title={isTownHall ? "Todo validado" : "Aún no hay acciones validadas"}
            description={
              isTownHall
                ? "Las nuevas acciones de las colonias del municipio aparecerán aquí."
                : "Cuando el ayuntamiento valide una acción, aparecerá aquí."
            }
          />
        ) : null}
      </View>

      {!isTownHall && data && data.colonies.total === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="Empieza registrando vuestra primera colonia"
          description="Con su ubicación exacta y el municipio. Después podrás añadir sus gatos."
          action={
            isAdmin ? (
              <Link href="/colonias/nueva" asChild>
                <Button>Registrar colonia</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {!isTownHall && data && data.cats.withoutColony > 0 ? (
        <View className="flex-row items-center gap-2">
          <Icon icon={Cat} color="muted-foreground" size={14} />
          <Text className="flex-1 text-sm text-muted-foreground">
            {data.cats.withoutColony === 1
              ? "1 gato no está asignado a ninguna colonia."
              : `${formatInteger(data.cats.withoutColony)} gatos no están asignados a ninguna colonia.`}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
