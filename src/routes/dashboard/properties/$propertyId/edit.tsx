import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PropertyForm, propertyToFormValues } from "#/components/properties/PropertyForm";
import { propertyQuery } from "#/lib/queries";
import { m } from "#/paraglide/messages";
import { updateProperty } from "#/server/properties";

export const Route = createFileRoute("/dashboard/properties/$propertyId/edit")({
  loader: async ({ context, params }) => {
    const property = await context.queryClient.query({
      ...propertyQuery(params.propertyId),
      staleTime: "static",
    });
    if (!property) throw notFound();
  },
  head: () => ({ meta: [{ title: `${m.edit_property_title()} · SpainFolio` }] }),
  component: EditProperty,
});

function EditProperty() {
  const { propertyId } = Route.useParams();
  const { data: property } = useSuspenseQuery(propertyQuery(propertyId));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initialValues] = useState(() => (property ? propertyToFormValues(property) : null));

  if (!property || !initialValues) return null;

  const backToProperty = () =>
    navigate({ to: "/dashboard/properties/$propertyId", params: { propertyId } });

  return (
    <main className="page-container pt-4">
      <Link
        to="/dashboard/properties/$propertyId"
        params={{ propertyId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {property.name}
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-medium tracking-tight">{m.edit_property_title()}</h1>
        <p className="mt-1 text-muted-foreground">{m.edit_property_subtitle()}</p>
      </div>
      <PropertyForm
        mode="edit"
        initialValues={initialValues}
        submitLabel={m.action_save_changes()}
        onCancel={() => void backToProperty()}
        onSubmit={async ({ recurringItems: _ignored, ...values }) => {
          try {
            await updateProperty({ data: { id: propertyId, values } });
            await queryClient.invalidateQueries({ queryKey: ["properties"] });
            toast.success(m.toast_property_updated());
            await backToProperty();
          } catch {
            toast.error(m.error_generic());
          }
        }}
      />
    </main>
  );
}
