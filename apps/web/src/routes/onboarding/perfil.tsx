import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { AlertProfileForm, emptyProfileValues } from "@/components/alerts/AlertProfileForm";
import { api } from "@/lib/api";

export const Route = createFileRoute("/onboarding/perfil")({
  beforeLoad: ({ context }) => {
    if (!context.viewer?.company) throw redirect({ to: "/onboarding" });
  },
  head: () => ({ meta: [{ title: "Tu primera alerta · Licita" }] }),
  component: ProfileStep,
});

function ProfileStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <p className="eyebrow">Paso 2 de 2</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tu primer perfil de alertas</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Describe lo que haces y dónde. Buscaremos licitaciones abiertas que encajen y te avisaremos
        de las nuevas.
      </p>
      <AlertProfileForm
        wizard
        initial={emptyProfileValues()}
        submitLabel="Guardar y ver oportunidades"
        onSubmit={async (values) => {
          await api().alertProfiles.create(values);
          await queryClient.invalidateQueries();
          await router.navigate({ to: "/dashboard", search: { welcome: true } });
        }}
      />
    </>
  );
}
