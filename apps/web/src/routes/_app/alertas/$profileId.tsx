import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlertProfileForm, emptyProfileValues } from "@/components/alerts/AlertProfileForm";
import { PageHeader } from "@/components/app/states";
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
import type { ContractType, EmailFrequencyValue } from "@licita/domain/tenders";
import { api } from "@/lib/api";
import { errorMessage, isNotFound } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { alertProfileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/alertas/$profileId")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.profileId)) throw notFound();
    try {
      await context.queryClient.ensureQueryData(alertProfileQuery(params.profileId));
    } catch (error) {
      if (isNotFound(error)) throw notFound();
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Editar perfil de alertas · Licita" }] }),
  component: EditProfile,
});

const amount = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

function EditProfile() {
  const { profileId } = Route.useParams();
  const { data: profile } = useSuspenseQuery(alertProfileQuery(profileId));
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api().alertProfiles.delete(profileId),
    onSuccess: async () => {
      toast.success("Perfil eliminado");
      await queryClient.invalidateQueries();
      await router.navigate({ to: "/alertas" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={profile.name}
        description="Al guardar recalculamos las coincidencias con las licitaciones abiertas."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="bg-card text-negative hover:text-negative">
                <Trash2 /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este perfil?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrarán sus coincidencias y dejarás de recibir sus avisos. Tus licitaciones
                  guardadas no se verán afectadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate()}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />
      <AlertProfileForm
        key={profile.updatedAt.toString()}
        initial={emptyProfileValues({
          name: profile.name,
          serviceDescription: profile.serviceDescription,
          sectors: profile.sectors,
          cpv: profile.cpvOptions,
          includeKeywords: profile.includeKeywords,
          excludeKeywords: profile.excludeKeywords,
          provinceCodes: profile.provinceCodes,
          nationwide: profile.nationwide,
          contractTypes: profile.contractTypes as ContractType[],
          minBudget: amount(profile.minBudgetEur),
          maxBudget: amount(profile.maxBudgetEur),
          emailFrequency: profile.emailFrequency as EmailFrequencyValue,
          isActive: profile.isActive,
        })}
        submitLabel="Guardar cambios"
        onCancel={() => router.history.back()}
        onSubmit={async (values) => {
          const result = await api().alertProfiles.update(profileId, values);
          await queryClient.invalidateQueries();
          toast.success(
            result.matches != null
              ? `Cambios guardados: ${pluralize(result.matches, "coincidencia abierta", "coincidencias abiertas")}`
              : "Cambios guardados",
          );
        }}
      />
    </div>
  );
}
