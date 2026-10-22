import { useNavigate } from "@tanstack/react-router";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { Header } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { TrendBadge } from "#/components/finance";
import { PropertyTypeIcon } from "#/components/properties/PropertyTypeIcon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { formatCurrency, formatMonth, formatPercent } from "#/lib/format";
import { propertyTypeLabel } from "#/lib/labels";
import { propertyMetrics } from "#/lib/portfolio";
import type { PropertyData } from "#/lib/portfolio";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text },
});

interface PropertyRow {
  id: string;
  name: string;
  city: string;
  type: string;
  value: number;
  momPct: number;
  appreciationPct: number;
  equity: number;
  cashFlow: number;
  netYield: number;
  paybackMonth: string | null;
  paybackAchieved: boolean;
}

const columnHelper = createColumnHelper<typeof features, PropertyRow>();

export function PropertiesTable({
  properties,
  now,
  className,
}: {
  properties: PropertyData[];
  now: Date;
  className?: string;
}) {
  const navigate = useNavigate();

  const data = useMemo<PropertyRow[]>(
    () =>
      properties.map((p) => {
        const metrics = propertyMetrics(p, now);
        return {
          id: p.id,
          name: p.name,
          city: p.city,
          type: p.type,
          value: p.currentValue,
          momPct: metrics.monthOverMonthPct,
          appreciationPct: metrics.appreciationPct,
          equity: metrics.equity,
          cashFlow: metrics.monthlyCashFlow,
          netYield: metrics.netYield,
          paybackMonth: metrics.payback.month,
          paybackAchieved: metrics.payback.achieved,
        };
      }),
    [properties, now],
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("name", {
          header: () => m.table_property(),
          sortFn: "alphanumeric",
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <PropertyTypeIcon type={row.original.type} />
              <div className="min-w-0">
                <p className="truncate font-medium">{row.original.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.original.city} · {propertyTypeLabel(row.original.type)}
                </p>
              </div>
            </div>
          ),
        }),
        columnHelper.accessor("value", {
          header: () => m.table_value(),
          sortFn: "basic",
          cell: ({ row }) => (
            <div className="flex flex-col items-end gap-1">
              <span className="figure font-medium">{formatCurrency(row.original.value)}</span>
              <TrendBadge value={row.original.momPct} variant="plain" decimals={2} />
            </div>
          ),
        }),
        columnHelper.accessor("appreciationPct", {
          header: () => m.table_appreciation(),
          sortFn: "basic",
          cell: ({ row }) => (
            <TrendBadge value={row.original.appreciationPct} className="ml-auto" />
          ),
        }),
        columnHelper.accessor("equity", {
          header: () => m.kpi_equity(),
          sortFn: "basic",
          cell: ({ getValue }) => <span className="figure">{formatCurrency(getValue())}</span>,
        }),
        columnHelper.accessor("cashFlow", {
          header: () => m.table_cash_flow(),
          sortFn: "basic",
          cell: ({ getValue }) => (
            <span className={cn("figure", getValue() < 0 ? "text-negative" : "text-positive")}>
              {formatCurrency(getValue(), { signed: true })}
            </span>
          ),
        }),
        columnHelper.accessor("netYield", {
          header: () => m.kpi_net_yield(),
          sortFn: "basic",
          cell: ({ getValue }) => <span className="figure">{formatPercent(getValue())}</span>,
        }),
        columnHelper.accessor("paybackMonth", {
          header: () => m.kpi_payback_date(),
          sortFn: "text",
          cell: ({ row }) =>
            row.original.paybackMonth ? (
              <span
                className={cn(
                  "figure whitespace-nowrap",
                  row.original.paybackAchieved && "text-positive",
                )}
              >
                {formatMonth(row.original.paybackMonth, "medium")}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        }),
      ]),
    [],
  );

  const table = useTable({
    features,
    data,
    columns,
    getRowId: (row) => row.id,
    initialState: { sorting: [{ id: "value", desc: true }] },
  });

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table className="min-w-[860px]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-border/70 hover:bg-transparent">
              {headerGroup.headers.map((header, index) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-10 text-xs font-normal text-muted-foreground",
                    index > 0 && "text-right",
                  )}
                >
                  <SortableHeader header={header} alignRight={index > 0} />
                </TableHead>
              ))}
              <TableHead className="w-8" />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer border-border/60"
              onClick={() =>
                void navigate({
                  to: "/dashboard/properties/$propertyId",
                  params: { propertyId: row.original.id },
                })
              }
            >
              {row.getVisibleCells().map((cell, index) => (
                <TableCell key={cell.id} className={cn("py-3.5", index > 0 && "text-right")}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
              <TableCell className="text-muted-foreground">
                <ChevronRight className="size-4" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortableHeader({
  header,
  alignRight,
}: {
  header: Header<typeof features, PropertyRow, unknown>;
  alignRight: boolean;
}) {
  const sorted = header.column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        alignRight && "flex-row-reverse",
        sorted && "text-foreground",
      )}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      <Icon className={cn("size-3", !sorted && "opacity-40")} />
    </button>
  );
}
