import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/states";
import { CompanyForm } from "@/components/forms/CompanyForm";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { companySettingsQuery, deliveriesQuery, viewerQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/ajustes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(companySettingsQuery),
  head: () => ({ meta: [{ title: "Ajustes · Licita" }] }),
  component: Settings,
});

const PLANS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };
const DELIVERY_STATUS: Record<string, string> = {
  queued: "En cola",
  sent: "Enviado",
  failed: "Error",
  cancelled: "Cancelado",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface grid gap-6 p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Settings() {
  const { data } = useSuspenseQuery(companySettingsQuery);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(data.me.fullName ?? "");
  const canManage = data.role === "owner" || data.role === "admin";

  const saveName = useMutation({
    mutationFn: () => api().me.update({ fullName }),
    onSuccess: async () => {
      toast.success("Nombre actualizado");
      await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deliveries = useQuery(deliveriesQuery);
  const sendTest = useMutation({
    mutationFn: () => api().notifications.sendTest(),
    onSuccess: async (result) => {
      if (result.status === "sent") toast.success(`Correo de prueba enviado a ${data.me.email}`);
      else if (result.status === "throttled")
        toast.info("Ya has enviado una prueba hace un momento. Espera un minuto.");
      else toast.error(`No se pudo enviar: ${result.error ?? "error del proveedor"}`);
      await deliveries.refetch();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const c = data.company;
  return (
    <>
      <PageHeader title="Ajustes" description="Datos de tu empresa, tu cuenta y tus avisos." />
      <div className="space-y-6">
        <Section
          title="Empresa"
          description={
            canManage
              ? "Los datos fiscales son opcionales."
              : "Solo los administradores pueden editar estos datos."
          }
        >
          <CompanyForm
            extended
            disabled={!canManage}
            initial={{
              legalName: c.legalName,
              displayName: c.displayName ?? "",
              companyType: c.companyType ?? "",
              baseProvinceCode: c.baseProvinceCode ?? "",
              baseMunicipality: c.baseMunicipality ?? "",
              businessDescription: c.businessDescription ?? "",
              taxId: c.taxId ?? "",
            }}
            submitLabel="Guardar empresa"
            onSubmit={async (values) => {
              await api().companies.updateCurrent(values);
              toast.success("Datos de la empresa guardados");
              await queryClient.invalidateQueries();
              await router.invalidate();
            }}
          />
        </Section>

        <Section
          title="Tu cuenta"
          description="Tu email se usa para iniciar sesión y recibir avisos."
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveName.mutate();
            }}
          >
            <Field id="email" label="Email">
              <Input id="email" value={data.me.email} disabled className="bg-muted" />
            </Field>
            <Field id="fullName" label="Nombre">
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-card"
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              disabled={saveName.isPending || !fullName.trim()}
            >
              Guardar nombre
            </Button>
          </form>
        </Section>

        <Section
          title="Avisos por correo"
          description="La frecuencia se elige en cada perfil de alertas. Aquí puedes comprobar que los correos te llegan."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => sendTest.mutate()} disabled={sendTest.isPending}>
              {sendTest.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Enviar correo de prueba
            </Button>
            <span className="text-sm text-muted-foreground">Se enviará a {data.me.email}</span>
          </div>
          <h3 className="mt-6 text-sm font-medium">Historial</h3>
          {deliveries.data?.length ? (
            <ul className="mt-2 divide-y rounded-lg border text-sm">
              {deliveries.data.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {d.notificationType === "test" ? "Prueba" : "Nueva oportunidad"} ·{" "}
                      {formatDateTime(d.sentAt ?? d.scheduledAt)}
                    </span>
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      d.status === "failed" ? "border-negative/30 text-negative" : undefined
                    }
                    title={d.errorMessage ?? undefined}
                  >
                    {DELIVERY_STATUS[d.status] ?? d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Sin envíos todavía.</p>
          )}
        </Section>

        <Section title="Plan" description="Los planes de pago llegarán más adelante.">
          <div className="flex items-center gap-3">
            <Badge className="rounded-md bg-brand-soft text-brand-strong">
              {PLANS[data.subscription?.planCode ?? "free"] ?? data.subscription?.planCode}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {data.subscription?.status === "active" ? "Activo" : "Inactivo"}
            </span>
          </div>
        </Section>

        <Section title="Privacidad">
          <p className="text-sm text-muted-foreground">
            Solo guardamos tu nombre, email y los datos de empresa que decidas añadir. Tus perfiles,
            coincidencias, notas y tareas son privados de tu empresa. Para ejercer tus derechos de
            acceso, rectificación o supresión, escríbenos desde tu email de acceso.
          </p>
        </Section>
      </div>
    </>
  );
}
