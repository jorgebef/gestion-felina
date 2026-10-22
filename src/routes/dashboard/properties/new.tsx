import { useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PropertyForm, emptyPropertyValues } from "#/components/properties/PropertyForm";
import { m } from "#/paraglide/messages";
import { createProperty } from "#/server/properties";

export const Route = createFileRoute("/dashboard/properties/new")({
  head: () => ({ meta: [{ title: `${m.new_property_title()} · SpainFolio` }] }),
  component: NewProperty,
});

function NewProperty() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [initialValues] = useState(emptyPropertyValues);

  return (
    <main className="page-container pt-4">
      <Link
        to="/dashboard/properties"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {m.app_nav_properties()}
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-3xl font-medium tracking-tight">{m.new_property_title()}</h1>
        <p className="mt-1 text-muted-foreground">{m.new_property_subtitle()}</p>
      </div>
      <PropertyForm
        mode="create"
        initialValues={initialValues}
        submitLabel={m.new_property_submit()}
        onCancel={() => void navigate({ to: "/dashboard/properties" })}
        onSubmit={async (input) => {
          try {
            const created = await createProperty({ data: input });
            await queryClient.invalidateQueries({ queryKey: ["properties"] });
            toast.success(m.toast_property_created());
            await navigate({
              to: "/dashboard/properties/$propertyId",
              params: { propertyId: created.id },
            });
          } catch {
            toast.error(m.error_generic());
          }
        }}
      />
    </main>
  );
}
