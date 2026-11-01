import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { CompanyForm } from "@/components/forms/CompanyForm";
import { api } from "@/lib/api";
import { viewerQuery } from "@/lib/queries";

export const Route = createFileRoute("/onboarding/")({
  beforeLoad: ({ context }) => {
    if (context.viewer?.company) throw redirect({ to: "/onboarding/perfil" });
  },
  head: () => ({ meta: [{ title: "Tu empresa · Licita" }] }),
  component: CompanyStep,
});

function CompanyStep() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <p className="eyebrow">Paso 1 de 2</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cuéntanos quién eres</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Solo lo básico. Podrás completar el resto más adelante en Ajustes.
      </p>
      <div className="surface mt-6 p-5 sm:p-6">
        <CompanyForm
          initial={{
            legalName: "",
            displayName: "",
            companyType: "",
            baseProvinceCode: "",
            baseMunicipality: "",
            businessDescription: "",
            taxId: "",
          }}
          submitLabel="Continuar"
          onSubmit={async (values) => {
            await api().companies.create(values);
            await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
            await router.invalidate();
            await router.navigate({ to: "/onboarding/perfil" });
          }}
        />
      </div>
    </>
  );
}
