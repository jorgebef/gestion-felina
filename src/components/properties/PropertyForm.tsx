import { useForm, useStore } from "@tanstack/react-form";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { KeyValue } from "#/components/finance";
import { FormField, UnitInput, inputClass, selectTriggerClass } from "#/components/forms/fields";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { formatCurrency, formatPercent, todayIso } from "#/lib/format";
import { categoryLabel, frequencyLabel, propertyTypeLabel } from "#/lib/labels";
import { monthlyEquivalent, mortgagePayment } from "#/lib/portfolio";
import {
  EXPENSE_CATEGORIES,
  FREQUENCIES,
  INCOME_CATEGORIES,
  PROPERTY_TYPES,
  PROVINCES,
  createPropertySchema,
  propertyInputSchema,
} from "#/lib/schemas";
import type { CreatePropertyInput, PropertyInput, PropertyType } from "#/lib/schemas";
import { cn } from "#/lib/utils";
import { parseNumber, zodFieldErrors } from "#/lib/validation";
import { m } from "#/paraglide/messages";

type Kind = "income" | "expense";
type Frequency = (typeof FREQUENCIES)[number];

export interface RecurringRow {
  kind: Kind;
  category: string;
  label: string;
  amount: string;
  frequency: Frequency;
  startDate: string;
}

export interface PropertyFormValues {
  name: string;
  type: PropertyType;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  sizeSqm: string;
  bedrooms: string;
  purchaseDate: string;
  purchasePrice: string;
  transferTax: string;
  notaryFees: string;
  agencyFees: string;
  renovationCosts: string;
  currentValue: string;
  hasMortgage: boolean;
  mortgagePrincipal: string;
  mortgageInterestRate: string;
  mortgageTermYears: string;
  mortgageStartDate: string;
  mortgagePaidOff: string;
  recurringItems: RecurringRow[];
}

export function emptyPropertyValues(): PropertyFormValues {
  const today = todayIso();
  const row = (
    kind: Kind,
    category: string,
    label: string,
    frequency: Frequency,
  ): RecurringRow => ({
    kind,
    category,
    label,
    amount: "",
    frequency,
    startDate: today,
  });
  return {
    name: "",
    type: "apartment",
    address: "",
    city: "",
    province: "Madrid",
    postalCode: "",
    sizeSqm: "",
    bedrooms: "",
    purchaseDate: today,
    purchasePrice: "",
    transferTax: "",
    notaryFees: "",
    agencyFees: "",
    renovationCosts: "",
    currentValue: "",
    hasMortgage: false,
    mortgagePrincipal: "",
    mortgageInterestRate: "",
    mortgageTermYears: "25",
    mortgageStartDate: today,
    mortgagePaidOff: "",
    recurringItems: [
      row("income", "rent", m.default_item_rent(), "monthly"),
      row("expense", "community_fees", m.category_community_fees(), "monthly"),
      row("expense", "ibi_tax", m.category_ibi_tax(), "yearly"),
      row("expense", "insurance", m.category_insurance(), "yearly"),
    ],
  };
}

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function propertyToFormValues(p: PropertyInput): PropertyFormValues {
  return {
    name: p.name,
    type: p.type,
    address: p.address,
    city: p.city,
    province: p.province,
    postalCode: p.postalCode ?? "",
    sizeSqm: str(p.sizeSqm),
    bedrooms: str(p.bedrooms),
    purchaseDate: p.purchaseDate,
    purchasePrice: str(p.purchasePrice),
    transferTax: str(p.transferTax),
    notaryFees: str(p.notaryFees),
    agencyFees: str(p.agencyFees),
    renovationCosts: str(p.renovationCosts),
    currentValue: str(p.currentValue),
    hasMortgage: p.hasMortgage,
    mortgagePrincipal: p.hasMortgage ? str(p.mortgagePrincipal) : "",
    mortgageInterestRate: p.hasMortgage ? str(p.mortgageInterestRate) : "",
    mortgageTermYears: p.hasMortgage ? str(p.mortgageTermYears) : "25",
    mortgageStartDate: p.mortgageStartDate ?? p.purchaseDate,
    mortgagePaidOff: p.hasMortgage ? str(p.mortgagePaidOff) : "",
    recurringItems: [],
  };
}

function toPropertyInput(v: PropertyFormValues): PropertyInput {
  return {
    name: v.name,
    type: v.type,
    address: v.address,
    city: v.city,
    province: v.province,
    postalCode: v.postalCode.trim() || null,
    sizeSqm: parseNumber(v.sizeSqm, null),
    bedrooms: parseNumber(v.bedrooms, null),
    purchaseDate: v.purchaseDate,
    purchasePrice: parseNumber(v.purchasePrice, Number.NaN),
    transferTax: parseNumber(v.transferTax, 0),
    notaryFees: parseNumber(v.notaryFees, 0),
    agencyFees: parseNumber(v.agencyFees, 0),
    renovationCosts: parseNumber(v.renovationCosts, 0),
    currentValue: parseNumber(v.currentValue, parseNumber(v.purchasePrice, Number.NaN)),
    hasMortgage: v.hasMortgage,
    mortgagePrincipal: v.hasMortgage ? parseNumber(v.mortgagePrincipal, 0) : 0,
    mortgageInterestRate: v.hasMortgage ? parseNumber(v.mortgageInterestRate, 0) : 0,
    mortgageTermYears: v.hasMortgage ? parseNumber(v.mortgageTermYears, 0) : 0,
    mortgageStartDate: v.hasMortgage ? v.mortgageStartDate || v.purchaseDate : null,
    mortgagePaidOff: v.hasMortgage ? parseNumber(v.mortgagePaidOff, 0) : 0,
  };
}

/** Rows without an amount are treated as "not applicable" and skipped. */
function filledRecurring(rows: RecurringRow[]) {
  return rows.map((row, index) => ({ row, index })).filter(({ row }) => row.amount.trim() !== "");
}

function toCreateInput(v: PropertyFormValues): CreatePropertyInput {
  return {
    ...toPropertyInput(v),
    recurringItems: filledRecurring(v.recurringItems).map(({ row }) => ({
      kind: row.kind,
      category: row.category,
      label: row.label.trim() || categoryLabel(row.category),
      amount: Number(row.amount),
      frequency: row.frequency,
      startDate: row.startDate || v.purchaseDate,
      endDate: null,
    })),
  };
}

export function PropertyForm({
  mode,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initialValues: PropertyFormValues;
  submitLabel: string;
  onSubmit: (input: CreatePropertyInput) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: ({ value }) => {
        if (mode === "create") {
          const result = createPropertySchema.safeParse(toCreateInput(value));
          if (result.success) return undefined;
          // Re-map recurring item indexes from the filtered list back to the form rows.
          const rows = filledRecurring(value.recurringItems);
          const issues = result.error.issues.map((issue) => {
            if (issue.path[0] === "recurringItems" && typeof issue.path[1] === "number") {
              return {
                ...issue,
                path: ["recurringItems", rows[issue.path[1]].index, ...issue.path.slice(2)],
              };
            }
            return issue;
          });
          return { fields: zodFieldErrors(issues) };
        }
        const result = propertyInputSchema.safeParse(toPropertyInput(value));
        return result.success ? undefined : { fields: zodFieldErrors(result.error.issues) };
      },
    },
    onSubmit: async ({ value }) => {
      await onSubmit(toCreateInput(value));
    },
  });

  const values = useStore(form.store, (s) => s.values);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="grid gap-5 lg:grid-cols-[1fr_340px]"
    >
      <div className="min-w-0 space-y-5">
        <FormSection
          step={1}
          title={m.form_section_details()}
          description={m.form_section_details_hint()}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="name">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_name()}
                  error={field.state.meta.errors[0]}
                  className="sm:col-span-2"
                >
                  <Input
                    id={field.name}
                    placeholder={m.form_name_placeholder()}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="type">
              {(field) => (
                <FormField id={field.name} label={m.form_type()}>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as PropertyType)}
                  >
                    <SelectTrigger id={field.name} className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {propertyTypeLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="sizeSqm">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_size()}
                    error={field.state.meta.errors[0]}
                  >
                    <UnitInput
                      id={field.name}
                      unit="m²"
                      step="1"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="bedrooms">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_bedrooms()}
                    error={field.state.meta.errors[0]}
                  >
                    <UnitInput
                      id={field.name}
                      unit="#"
                      step="1"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="address">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_address()}
                  error={field.state.meta.errors[0]}
                  className="sm:col-span-2"
                >
                  <Input
                    id={field.name}
                    placeholder={m.form_address_placeholder()}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="city">
              {(field) => (
                <FormField id={field.name} label={m.form_city()} error={field.state.meta.errors[0]}>
                  <Input
                    id={field.name}
                    placeholder="Madrid"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              )}
            </form.Field>
            <div className="grid grid-cols-[1fr_120px] gap-4">
              <form.Field name="province">
                {(field) => (
                  <FormField id={field.name} label={m.form_province()}>
                    <Select value={field.state.value} onValueChange={field.handleChange}>
                      <SelectTrigger id={field.name} className={selectTriggerClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {PROVINCES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              </form.Field>
              <form.Field name="postalCode">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_postal_code()}
                    error={field.state.meta.errors[0]}
                  >
                    <Input
                      id={field.name}
                      inputMode="numeric"
                      placeholder="28001"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={inputClass}
                    />
                  </FormField>
                )}
              </form.Field>
            </div>
          </div>
        </FormSection>

        <FormSection
          step={2}
          title={m.form_section_acquisition()}
          description={m.form_section_acquisition_hint()}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="purchaseDate">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_purchase_date()}
                  error={field.state.meta.errors[0]}
                >
                  <Input
                    id={field.name}
                    type="date"
                    max={todayIso()}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="purchasePrice">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_purchase_price()}
                  error={field.state.meta.errors[0]}
                >
                  <UnitInput
                    id={field.name}
                    unit="€"
                    placeholder="250000"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    invalid={field.state.meta.errors.length > 0}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="transferTax">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_transfer_tax()}
                  error={field.state.meta.errors[0]}
                  hint={
                    <span className="flex flex-wrap items-center gap-1">
                      {m.form_transfer_tax_hint()}
                      {[4, 6, 8, 10].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-foreground hover:text-white disabled:opacity-40"
                          disabled={!Number(values.purchasePrice)}
                          onClick={() =>
                            field.handleChange(
                              String(Math.round((Number(values.purchasePrice) * rate) / 100)),
                            )
                          }
                        >
                          {rate}%
                        </button>
                      ))}
                    </span>
                  }
                >
                  <UnitInput
                    id={field.name}
                    unit="€"
                    placeholder="0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="notaryFees">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_notary_fees()}
                  hint={m.form_notary_fees_hint()}
                  error={field.state.meta.errors[0]}
                >
                  <UnitInput
                    id={field.name}
                    unit="€"
                    placeholder="0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="agencyFees">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_agency_fees()}
                  error={field.state.meta.errors[0]}
                >
                  <UnitInput
                    id={field.name}
                    unit="€"
                    placeholder="0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="renovationCosts">
              {(field) => (
                <FormField
                  id={field.name}
                  label={m.form_renovation_costs()}
                  error={field.state.meta.errors[0]}
                >
                  <UnitInput
                    id={field.name}
                    unit="€"
                    placeholder="0"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                  />
                </FormField>
              )}
            </form.Field>
          </div>
        </FormSection>

        <FormSection
          step={3}
          title={m.form_section_valuation()}
          description={m.form_section_valuation_hint()}
        >
          <form.Field name="currentValue">
            {(field) => (
              <FormField
                id={field.name}
                label={m.form_current_value()}
                hint={m.form_current_value_hint()}
                error={field.state.meta.errors[0]}
                className="sm:max-w-sm"
              >
                <UnitInput
                  id={field.name}
                  unit="€"
                  placeholder={values.purchasePrice || "275000"}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                />
              </FormField>
            )}
          </form.Field>
        </FormSection>

        <FormSection
          step={4}
          title={m.form_section_financing()}
          description={m.form_section_financing_hint()}
          action={
            <form.Field name="hasMortgage">
              {(field) => (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  {m.form_has_mortgage()}
                  <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                </label>
              )}
            </form.Field>
          }
        >
          {values.hasMortgage ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="mortgagePrincipal">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_mortgage_principal()}
                    error={field.state.meta.errors[0]}
                  >
                    <UnitInput
                      id={field.name}
                      unit="€"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="mortgageInterestRate">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_mortgage_rate()}
                    hint={m.form_mortgage_rate_hint()}
                    error={field.state.meta.errors[0]}
                  >
                    <UnitInput
                      id={field.name}
                      unit="%"
                      step="0.01"
                      placeholder="3.1"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="mortgageTermYears">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_mortgage_term()}
                    error={field.state.meta.errors[0]}
                  >
                    <UnitInput
                      id={field.name}
                      unit={m.unit_years()}
                      step="1"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="mortgageStartDate">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_mortgage_start()}
                    error={field.state.meta.errors[0]}
                  >
                    <Input
                      id={field.name}
                      type="date"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className={inputClass}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="mortgagePaidOff">
                {(field) => (
                  <FormField
                    id={field.name}
                    label={m.form_mortgage_paid_off()}
                    hint={m.form_mortgage_paid_off_hint()}
                    error={field.state.meta.errors[0]}
                    className="sm:col-span-2 sm:max-w-sm"
                  >
                    <UnitInput
                      id={field.name}
                      unit="€"
                      placeholder="0"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                    />
                  </FormField>
                )}
              </form.Field>
            </div>
          ) : (
            <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              {m.form_no_mortgage()}
            </p>
          )}
        </FormSection>

        {mode === "create" ? (
          <FormSection
            step={5}
            title={m.form_section_recurring()}
            description={m.form_section_recurring_hint()}
          >
            <form.Field name="recurringItems" mode="array">
              {(arrayField) => (
                <div className="space-y-3">
                  {arrayField.state.value.map((row, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
                        <form.Field name={`recurringItems[${index}].kind`}>
                          {(field) => (
                            <Select
                              value={field.state.value}
                              onValueChange={(v) => {
                                field.handleChange(v as Kind);
                                form.setFieldValue(
                                  `recurringItems[${index}].category`,
                                  v === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
                                );
                              }}
                            >
                              <SelectTrigger
                                aria-label={m.form_kind()}
                                className={cn(
                                  selectTriggerClass,
                                  "h-10",
                                  row.kind === "income" ? "text-positive" : "text-negative",
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">{m.kind_income()}</SelectItem>
                                <SelectItem value="expense">{m.kind_expense()}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </form.Field>
                        <form.Field name={`recurringItems[${index}].category`}>
                          {(field) => (
                            <Select value={field.state.value} onValueChange={field.handleChange}>
                              <SelectTrigger
                                aria-label={m.form_category()}
                                className={cn(selectTriggerClass, "h-10")}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(row.kind === "income"
                                  ? INCOME_CATEGORIES
                                  : EXPENSE_CATEGORIES
                                ).map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {categoryLabel(c)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </form.Field>
                        <form.Field name={`recurringItems[${index}].label`}>
                          {(field) => (
                            <Input
                              aria-label={m.form_label()}
                              placeholder={m.form_label()}
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="h-10 rounded-xl bg-card"
                            />
                          )}
                        </form.Field>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                        <form.Field name={`recurringItems[${index}].amount`}>
                          {(field) => (
                            <div>
                              <UnitInput
                                id={`recurring-${index}-amount`}
                                unit="€"
                                placeholder="0"
                                value={field.state.value}
                                onChange={field.handleChange}
                                invalid={field.state.meta.errors.length > 0}
                                className="[&_input]:h-10"
                              />
                              {typeof field.state.meta.errors[0] === "string" ? (
                                <p className="mt-1 text-xs text-negative">
                                  {field.state.meta.errors[0]}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </form.Field>
                        <form.Field name={`recurringItems[${index}].frequency`}>
                          {(field) => (
                            <Select
                              value={field.state.value}
                              onValueChange={(v) => field.handleChange(v as Frequency)}
                            >
                              <SelectTrigger
                                aria-label={m.form_frequency()}
                                className={cn(selectTriggerClass, "h-10")}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FREQUENCIES.map((f) => (
                                  <SelectItem key={f} value={f}>
                                    {frequencyLabel(f)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </form.Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 rounded-xl text-muted-foreground hover:text-negative"
                          aria-label={m.action_remove()}
                          onClick={() => arrayField.removeValue(index)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          arrayField.pushValue({
                            kind: "income",
                            category: "rent",
                            label: "",
                            amount: "",
                            frequency: "monthly",
                            startDate: values.purchaseDate,
                          })
                        }
                      >
                        <Plus />
                        {m.form_add_income()}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          arrayField.pushValue({
                            kind: "expense",
                            category: "maintenance",
                            label: "",
                            amount: "",
                            frequency: "monthly",
                            startDate: values.purchaseDate,
                          })
                        }
                      >
                        <Plus />
                        {m.form_add_expense()}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.form_recurring_blank_hint()}</p>
                  </div>
                </div>
              )}
            </form.Field>
          </FormSection>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <LiveSummary values={values} />
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-full"
            onClick={onCancel}
          >
            {m.action_cancel()}
          </Button>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                className="h-11 flex-[1.4] rounded-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {submitLabel}
              </Button>
            )}
          </form.Subscribe>
        </div>
        <form.Subscribe selector={(s) => s.submissionAttempts > 0 && !s.isValid}>
          {(showError) =>
            showError ? (
              <p className="mt-3 rounded-xl bg-negative-soft px-3 py-2 text-xs text-negative">
                {m.form_fix_errors()}
              </p>
            ) : null
          }
        </form.Subscribe>
      </aside>
    </form>
  );
}

function LiveSummary({ values }: { values: PropertyFormValues }) {
  const n = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);
  const price = n(values.purchasePrice);
  const costs =
    n(values.transferTax) + n(values.notaryFees) + n(values.agencyFees) + n(values.renovationCosts);
  const investment = price + costs;
  const principal = values.hasMortgage ? n(values.mortgagePrincipal) : 0;
  const payment = values.hasMortgage
    ? mortgagePayment(principal, n(values.mortgageInterestRate), n(values.mortgageTermYears))
    : 0;
  const recurring = values.recurringItems.filter((r) => r.amount.trim() !== "");
  const income = recurring
    .filter((r) => r.kind === "income")
    .reduce((s, r) => s + monthlyEquivalent({ amount: n(r.amount), frequency: r.frequency }), 0);
  const expenses = recurring
    .filter((r) => r.kind === "expense")
    .reduce((s, r) => s + monthlyEquivalent({ amount: n(r.amount), frequency: r.frequency }), 0);
  const value = n(values.currentValue) || price;

  return (
    <div className="overflow-hidden rounded-3xl bg-foreground text-white">
      <div className="hero-gradient relative px-6 pt-6 pb-5">
        <div className="hero-grain pointer-events-none absolute inset-0" />
        <p className="relative text-xs text-white/70">{m.form_summary_total_investment()}</p>
        <p className="figure relative mt-1 text-3xl font-medium">{formatCurrency(investment)}</p>
        <p className="relative mt-1 text-xs text-white/70">
          {m.form_summary_costs_share({
            costs: formatCurrency(costs),
            share: formatPercent(price ? costs / price : 0),
          })}
        </p>
      </div>
      <div className="divide-y divide-white/10 px-6 py-2 [&_span]:text-white/60 [&_span:last-child]:text-white">
        <KeyValue
          label={m.form_summary_cash_needed()}
          value={formatCurrency(Math.max(0, investment - principal))}
        />
        {values.hasMortgage ? (
          <KeyValue label={m.form_summary_mortgage_payment()} value={formatCurrency(payment)} />
        ) : null}
        <KeyValue
          label={m.form_summary_equity()}
          value={formatCurrency(value - principal + n(values.mortgagePaidOff))}
        />
        <KeyValue label={m.chart_rental_income()} value={formatCurrency(income)} />
        <KeyValue label={m.chart_operating_costs()} value={formatCurrency(-expenses)} />
        <KeyValue
          label={m.kpi_gross_yield()}
          value={formatPercent(price ? (income * 12) / price : 0)}
        />
        <KeyValue
          label={m.kpi_net_yield()}
          value={formatPercent(investment ? ((income - expenses) * 12) / investment : 0)}
        />
        <KeyValue
          label={m.kpi_monthly_cash_flow()}
          value={formatCurrency(income - expenses - payment, { signed: true })}
        />
      </div>
      <p className="px-6 pb-5 text-[11px] leading-relaxed text-white/45">{m.form_summary_note()}</p>
    </div>
  );
}

function FormSection({
  step,
  title,
  description,
  action,
  children,
}: {
  step: number;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="figure grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-medium text-white">
            {step}
          </span>
          <div>
            <h2 className="font-medium">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
