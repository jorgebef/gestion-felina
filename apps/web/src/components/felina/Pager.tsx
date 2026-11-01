import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatInteger } from "@/lib/format";

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {formatInteger(total)} en total · página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-card"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-card"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
