import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * An open invitation's link, to hand over again if the email got lost. `null` for
 * invitations created before links were stored: only re-inviting produces a new one.
 */
export function InvitationLink({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return (
      <p className="text-xs text-muted-foreground">
        Enlace no disponible para esta invitación. Vuelve a invitar a la persona para generar uno
        nuevo.
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace de invitación copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        readOnly
        value={url}
        aria-label="Enlace de invitación"
        onFocus={(e) => e.currentTarget.select()}
        className="h-8 min-w-0 bg-card font-mono text-xs"
      />
      <Button type="button" size="sm" variant="outline" className="shrink-0 bg-card" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}
