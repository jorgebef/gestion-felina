import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { FormField, UnitInput, inputClass, selectTriggerClass } from "#/components/forms/fields";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { todayIso } from "#/lib/format";
import { categoryLabel, frequencyLabel } from "#/lib/labels";
import {
  EXPENSE_CATEGORIES,
  FREQUENCIES,
  INCOME_CATEGORIES,
  oneOffItemSchema,
  recurringItemSchema,
  valuationSchema,
} from "#/lib/schemas";
import type { OneOffItemInput, RecurringItemInput } from "#/lib/schemas";
import { parseNumber, zodFieldErrors } from "#/lib/validation";
import { m } from "#/paraglide/messages";

type Kind = "income" | "expense";

function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-tight">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function KindToggle({ value, onChange }: { value: Kind; onChange: (kind: Kind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {(["income", "expense"] as const).map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onChange(kind)}
          className={
            value === kind
              ? "rounded-full bg-card py-2 text-sm font-medium shadow-sm"
              : "rounded-full py-2 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          {kind === "income" ? m.kind_income() : m.kind_expense()}
        </button>
      ))}
    </div>
  );
}

function SubmitRow({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <DialogFooter className="gap-2 pt-2">
      <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
        {m.action_cancel()}
      </Button>
      <Button type="submit" className="rounded-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {label}
      </Button>
    </DialogFooter>
  );
}

/* ------------------------------ Recurring items ----------------------------- */

export function RecurringItemDialog({
  open,
  onOpenChange,
  initial,
  defaultKind = "income",
  defaultStartDate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RecurringItemInput;
  defaultKind?: Kind;
  defaultStartDate: string;
  onSubmit: (item: RecurringItemInput) => Promise<void>;
}) {
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? m.recurring_edit_title() : m.recurring_add_title()}
      description={m.recurring_dialog_description()}
    >
      {open ? (
        <RecurringItemForm
          initial={initial}
          defaultKind={defaultKind}
          defaultStartDate={defaultStartDate}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      ) : null}
    </DialogShell>
  );
}

function RecurringItemForm({
  initial,
  defaultKind,
  defaultStartDate,
  onCancel,
  onSubmit,
}: {
  initial?: RecurringItemInput;
  defaultKind: Kind;
  defaultStartDate: string;
  onCancel: () => void;
  onSubmit: (item: RecurringItemInput) => Promise<void>;
}) {
  const toItem = (v: typeof defaultValues): RecurringItemInput => ({
    kind: v.kind,
    category: v.category,
    label: v.label.trim() || categoryLabel(v.category),
    amount: parseNumber(v.amount, Number.NaN),
    frequency: v.frequency,
    startDate: v.startDate,
    endDate: v.hasEnd && v.endDate ? v.endDate : null,
  });
  const defaultValues = {
    kind: initial?.kind ?? defaultKind,
    category: initial?.category ?? (defaultKind === "income" ? "rent" : "community_fees"),
    label: initial?.label ?? "",
    amount: initial ? String(initial.amount) : "",
    frequency: initial?.frequency ?? ("monthly" as (typeof FREQUENCIES)[number]),
    startDate: initial?.startDate ?? defaultStartDate,
    hasEnd: Boolean(initial?.endDate),
    endDate: initial?.endDate ?? "",
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const result = recurringItemSchema.safeParse(toItem(value));
        return result.success ? undefined : { fields: zodFieldErrors(result.error.issues) };
      },
    },
    onSubmit: ({ value }) => onSubmit(toItem(value)),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="kind">
        {(field) => (
          <KindToggle
            value={field.state.value}
            onChange={(kind) => {
              field.handleChange(kind);
              form.setFieldValue("category", kind === "income" ? "rent" : "community_fees");
            }}
          />
        )}
      </form.Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Subscribe selector={(s) => s.values.kind}>
          {(kind) => (
            <form.Field name="category">
              {(field) => (
                <FormField id={field.name} label={m.form_category()}>
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger id={field.name} className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <SelectItem key={c} value={c}>
                          {categoryLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </form.Field>
          )}
        </form.Subscribe>
        <form.Field name="label">
          {(field) => (
            <FormField id={field.name} label={m.form_label()} hint={m.form_label_hint()}>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="amount">
          {(field) => (
            <FormField id={field.name} label={m.form_amount()} error={field.state.meta.errors[0]}>
              <UnitInput
                id={field.name}
                unit="€"
                value={field.state.value}
                onChange={field.handleChange}
                invalid={field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="frequency">
          {(field) => (
            <FormField id={field.name} label={m.form_frequency()}>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as (typeof FREQUENCIES)[number])}
              >
                <SelectTrigger id={field.name} className={selectTriggerClass}>
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
            </FormField>
          )}
        </form.Field>
        <form.Field name="startDate">
          {(field) => (
            <FormField
              id={field.name}
              label={m.form_start_date()}
              error={field.state.meta.errors[0]}
            >
              <Input
                id={field.name}
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.hasEnd}>
          {(hasEnd) => (
            <div className="space-y-1.5">
              <form.Field name="hasEnd">
                {(field) => (
                  <label className="flex h-5 items-center justify-between gap-2 text-[13px] text-muted-foreground">
                    {m.form_end_date()}
                    <Switch checked={field.state.value} onCheckedChange={field.handleChange} />
                  </label>
                )}
              </form.Field>
              <form.Field name="endDate">
                {(field) => (
                  <Input
                    aria-label={m.form_end_date()}
                    type="date"
                    disabled={!hasEnd}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className={inputClass}
                  />
                )}
              </form.Field>
            </div>
          )}
        </form.Subscribe>
      </div>
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(pending) => <SubmitRow pending={pending} onCancel={onCancel} label={m.action_save()} />}
      </form.Subscribe>
    </form>
  );
}

/* ------------------------------- One-off items ------------------------------ */

export function OneOffItemDialog({
  open,
  onOpenChange,
  defaultKind = "expense",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: Kind;
  onSubmit: (item: OneOffItemInput) => Promise<void>;
}) {
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={m.one_off_add_title()}
      description={m.one_off_dialog_description()}
    >
      {open ? (
        <OneOffItemForm
          defaultKind={defaultKind}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      ) : null}
    </DialogShell>
  );
}

function OneOffItemForm({
  defaultKind,
  onCancel,
  onSubmit,
}: {
  defaultKind: Kind;
  onCancel: () => void;
  onSubmit: (item: OneOffItemInput) => Promise<void>;
}) {
  const defaultValues = {
    kind: defaultKind,
    category: defaultKind === "income" ? "insurance_claim" : "repairs",
    label: "",
    amount: "",
    date: todayIso(),
  };
  const toItem = (v: typeof defaultValues): OneOffItemInput => ({
    kind: v.kind,
    category: v.category,
    label: v.label.trim(),
    amount: parseNumber(v.amount, Number.NaN),
    date: v.date,
  });

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const result = oneOffItemSchema.safeParse(toItem(value));
        return result.success ? undefined : { fields: zodFieldErrors(result.error.issues) };
      },
    },
    onSubmit: ({ value }) => onSubmit(toItem(value)),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="kind">
        {(field) => (
          <KindToggle
            value={field.state.value}
            onChange={(kind) => {
              field.handleChange(kind);
              form.setFieldValue("category", kind === "income" ? "insurance_claim" : "repairs");
            }}
          />
        )}
      </form.Field>
      <form.Field name="label">
        {(field) => (
          <FormField
            id={field.name}
            label={m.form_description()}
            error={field.state.meta.errors[0]}
          >
            <Input
              id={field.name}
              placeholder={m.one_off_label_placeholder()}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className={inputClass}
            />
          </FormField>
        )}
      </form.Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <form.Subscribe selector={(s) => s.values.kind}>
          {(kind) => (
            <form.Field name="category">
              {(field) => (
                <FormField id={field.name} label={m.form_category()}>
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger id={field.name} className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <SelectItem key={c} value={c}>
                          {categoryLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </form.Field>
          )}
        </form.Subscribe>
        <form.Field name="amount">
          {(field) => (
            <FormField id={field.name} label={m.form_amount()} error={field.state.meta.errors[0]}>
              <UnitInput
                id={field.name}
                unit="€"
                value={field.state.value}
                onChange={field.handleChange}
                invalid={field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="date">
          {(field) => (
            <FormField id={field.name} label={m.form_date()} error={field.state.meta.errors[0]}>
              <Input
                id={field.name}
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(pending) => <SubmitRow pending={pending} onCancel={onCancel} label={m.action_add()} />}
      </form.Subscribe>
    </form>
  );
}

/* --------------------------------- Valuations -------------------------------- */

export function ValuationDialog({
  open,
  onOpenChange,
  currentValue,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue: number;
  onSubmit: (valuation: { date: string; value: number }) => Promise<void>;
}) {
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={m.valuation_add_title()}
      description={m.valuation_dialog_description()}
    >
      {open ? (
        <ValuationForm
          currentValue={currentValue}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      ) : null}
    </DialogShell>
  );
}

function ValuationForm({
  currentValue,
  onCancel,
  onSubmit,
}: {
  currentValue: number;
  onCancel: () => void;
  onSubmit: (valuation: { date: string; value: number }) => Promise<void>;
}) {
  const toValuation = (v: { date: string; value: string }) => ({
    date: v.date,
    value: parseNumber(v.value, Number.NaN),
  });
  const form = useForm({
    defaultValues: { date: todayIso(), value: String(currentValue) },
    validators: {
      onSubmit: ({ value }) => {
        const result = valuationSchema.safeParse(toValuation(value));
        return result.success ? undefined : { fields: zodFieldErrors(result.error.issues) };
      },
    },
    onSubmit: ({ value }) => onSubmit(toValuation(value)),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="value">
          {(field) => (
            <FormField
              id={field.name}
              label={m.form_estimated_value()}
              error={field.state.meta.errors[0]}
            >
              <UnitInput
                id={field.name}
                unit="€"
                value={field.state.value}
                onChange={field.handleChange}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="date">
          {(field) => (
            <FormField
              id={field.name}
              label={m.form_valuation_date()}
              error={field.state.meta.errors[0]}
            >
              <Input
                id={field.name}
                type="date"
                max={todayIso()}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className={inputClass}
              />
            </FormField>
          )}
        </form.Field>
      </div>
      <p className="rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
        {m.valuation_dialog_note()}
      </p>
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(pending) => <SubmitRow pending={pending} onCancel={onCancel} label={m.action_save()} />}
      </form.Subscribe>
    </form>
  );
}
