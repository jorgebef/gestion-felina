import { Link } from "@tanstack/react-router";
import { Building2, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { provinceName } from "@licita/domain/provinces";
import { formatDate, formatEurosCompact } from "@/lib/format";

import {
  ContractTypeLabel,
  Deadline,
  ScoreBadge,
  TenderStatusBadge,
  WorkflowBadge,
} from "./badges.tsx";

export interface TenderRow {
  id: string;
  title: string;
  authorityName: string | null;
  status: string;
  contractType: string | null;
  executionProvinces: string[];
  baseBudgetExVatEur: number | null;
  submissionDeadlineAt: Date | string | null;
  firstPublishedAt?: Date | string | null;
  score?: number | null;
  trackedStatus?: string | null;
  /** Extra line under the title (e.g. why it matched). */
  note?: ReactNode;
  actions?: ReactNode;
}

function places(codes: string[]): string {
  if (!codes.length) return "Ámbito no especificado";
  const names = codes.map((c) => provinceName(c) ?? c);
  return names.length > 3
    ? `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`
    : names.join(", ");
}

function TitleLink({ row }: { row: TenderRow }) {
  return (
    <Link
      to="/licitaciones/$tenderId"
      params={{ tenderId: row.id }}
      className="font-medium leading-snug text-foreground hover:text-brand hover:underline"
    >
      {row.title}
    </Link>
  );
}

/** Table on desktop, cards on small screens. */
export function TenderList({
  rows,
  showScore = false,
}: {
  rows: TenderRow[];
  showScore?: boolean;
}) {
  return (
    <>
      <div className="surface hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {showScore ? <TableHead className="w-14">Rel.</TableHead> : null}
              <TableHead>Licitación</TableHead>
              <TableHead className="w-32 text-right">Presupuesto sin IVA</TableHead>
              <TableHead className="w-52">Fecha límite</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              {rows.some((r) => r.actions) ? <TableHead className="w-28" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                {showScore ? (
                  <TableCell className="pt-4">
                    <ScoreBadge score={row.score ?? null} />
                  </TableCell>
                ) : null}
                <TableCell className="max-w-0 py-3 whitespace-normal">
                  <TitleLink row={row} />
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <Building2 className="size-3 shrink-0" />
                      <span className="truncate">
                        {row.authorityName ?? "Organismo no indicado"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3 shrink-0" />
                      {places(row.executionProvinces)}
                    </span>
                    <span>
                      <ContractTypeLabel type={row.contractType} />
                    </span>
                    {row.firstPublishedAt ? (
                      <span>Publicada {formatDate(row.firstPublishedAt)}</span>
                    ) : null}
                  </div>
                  {row.note ? (
                    <div className="mt-1.5 text-xs text-muted-foreground">{row.note}</div>
                  ) : null}
                </TableCell>
                <TableCell className="tabular pt-4 text-right font-medium">
                  {formatEurosCompact(row.baseBudgetExVatEur)}
                </TableCell>
                <TableCell className="pt-4 text-sm whitespace-normal">
                  <Deadline value={row.submissionDeadlineAt} compact />
                </TableCell>
                <TableCell className="space-y-1 pt-4">
                  <TenderStatusBadge status={row.status} />
                  {row.trackedStatus ? <WorkflowBadge status={row.trackedStatus} /> : null}
                </TableCell>
                {rows.some((r) => r.actions) ? (
                  <TableCell className="pt-3 text-right">{row.actions}</TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="surface p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <TitleLink row={row} />
              </div>
              {showScore ? <ScoreBadge score={row.score ?? null} /> : null}
            </div>
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              {row.authorityName ?? "Organismo no indicado"}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Presupuesto sin IVA</dt>
                <dd className="tabular font-medium">
                  {formatEurosCompact(row.baseBudgetExVatEur)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lugar</dt>
                <dd className="truncate">{places(row.executionProvinces)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Fecha límite</dt>
                <dd>
                  <Deadline value={row.submissionDeadlineAt} compact />
                </dd>
              </div>
            </dl>
            {row.note ? <div className="mt-2 text-xs text-muted-foreground">{row.note}</div> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TenderStatusBadge status={row.status} />
              {row.trackedStatus ? <WorkflowBadge status={row.trackedStatus} /> : null}
              {row.actions ? <div className="ml-auto">{row.actions}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  renderLink,
}: {
  page: number;
  pageCount: number;
  total: number;
  renderLink: (page: number, label: ReactNode, disabled: boolean) => ReactNode;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        Página {page} de {pageCount} · {total.toLocaleString("es-ES")} resultados
      </span>
      <div className="flex gap-2">
        {renderLink(page - 1, "Anterior", page <= 1)}
        {renderLink(page + 1, "Siguiente", page >= pageCount)}
      </div>
    </nav>
  );
}
