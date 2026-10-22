/**
 * Pure portfolio maths shared by the dashboard, property pages and server functions.
 *
 * Months are represented as integer indexes (`year * 12 + monthIndex`) so they can be
 * compared and iterated without timezone surprises. Dates come in as `YYYY-MM-DD` strings.
 */

export type CashFlowKind = "income" | "expense";
export type Frequency = "monthly" | "quarterly" | "yearly";

export interface RecurringItemData {
  id: string;
  kind: CashFlowKind;
  category: string;
  label: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
}

export interface OneOffItemData {
  id: string;
  kind: CashFlowKind;
  category: string;
  label: string;
  amount: number;
  date: string;
}

export interface ValuationData {
  id: string;
  date: string;
  value: number;
}

export interface PropertyData {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  province: string;
  purchaseDate: string;
  purchasePrice: number;
  transferTax: number;
  notaryFees: number;
  agencyFees: number;
  renovationCosts: number;
  currentValue: number;
  hasMortgage: boolean;
  mortgagePrincipal: number;
  mortgageInterestRate: number;
  mortgageTermYears: number;
  mortgageStartDate: string | null;
  mortgagePaidOff: number;
  recurringItems: RecurringItemData[];
  oneOffItems: OneOffItemData[];
  valuations: ValuationData[];
}

/* ---------------------------------- Months --------------------------------- */

export function toMonthIndex(date: string | Date): number {
  if (date instanceof Date) {
    return date.getFullYear() * 12 + date.getMonth();
  }
  const [year, month] = date.split("-").map(Number);
  return year * 12 + (month - 1);
}

export function monthKey(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthRange(start: number, end: number): number[] {
  const months: number[] = [];
  for (let i = start; i <= end; i++) months.push(i);
  return months;
}

/* ------------------------------- Acquisition ------------------------------- */

export function acquisitionCosts(p: PropertyData): number {
  return p.transferTax + p.notaryFees + p.agencyFees + p.renovationCosts;
}

/** Purchase price plus every cost needed to acquire and prepare the property. */
export function totalInvestment(p: PropertyData): number {
  return p.purchasePrice + acquisitionCosts(p);
}

/** Own capital put in: total investment minus the part financed by the mortgage. */
export function cashInvested(p: PropertyData): number {
  return Math.max(0, totalInvestment(p) - (p.hasMortgage ? p.mortgagePrincipal : 0));
}

/* --------------------------------- Mortgage -------------------------------- */

export function mortgagePayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function outstandingBalance(p: PropertyData): number {
  if (!p.hasMortgage) return 0;
  return Math.max(0, p.mortgagePrincipal - p.mortgagePaidOff);
}

export function equity(p: PropertyData): number {
  return p.currentValue - outstandingBalance(p);
}

/** Scheduled payment and interest for a given month, following a standard annuity. */
export function mortgageForMonth(
  p: PropertyData,
  month: number,
): { payment: number; interest: number } {
  if (!p.hasMortgage || p.mortgagePrincipal <= 0 || p.mortgageTermYears <= 0) {
    return { payment: 0, interest: 0 };
  }
  const start = toMonthIndex(p.mortgageStartDate ?? p.purchaseDate);
  const n = Math.round(p.mortgageTermYears * 12);
  const k = month - start;
  if (k < 0 || k >= n) return { payment: 0, interest: 0 };

  const payment = mortgagePayment(p.mortgagePrincipal, p.mortgageInterestRate, p.mortgageTermYears);
  const r = p.mortgageInterestRate / 100 / 12;
  if (r === 0) return { payment, interest: 0 };
  const growth = Math.pow(1 + r, k);
  const balance = p.mortgagePrincipal * growth - (payment * (growth - 1)) / r;
  return { payment, interest: Math.max(0, balance * r) };
}

/* -------------------------------- Cash flow -------------------------------- */

export function monthlyEquivalent(item: Pick<RecurringItemData, "amount" | "frequency">): number {
  switch (item.frequency) {
    case "quarterly":
      return item.amount / 3;
    case "yearly":
      return item.amount / 12;
    default:
      return item.amount;
  }
}

function isRecurringActive(item: RecurringItemData, month: number): boolean {
  if (toMonthIndex(item.startDate) > month) return false;
  if (item.endDate && toMonthIndex(item.endDate) < month) return false;
  return true;
}

export interface MonthCashFlow {
  income: number;
  expenses: number;
  oneOffIncome: number;
  oneOffExpenses: number;
  mortgagePayment: number;
  mortgageInterest: number;
  /** Cash that actually lands in / leaves the investor's account. */
  net: number;
  /** Economic profit: like `net` but only the interest part of the mortgage is a cost. */
  profit: number;
}

const emptyMonth = (): MonthCashFlow => ({
  income: 0,
  expenses: 0,
  oneOffIncome: 0,
  oneOffExpenses: 0,
  mortgagePayment: 0,
  mortgageInterest: 0,
  net: 0,
  profit: 0,
});

export function cashFlowForMonth(p: PropertyData, month: number): MonthCashFlow {
  const result = emptyMonth();
  if (month < toMonthIndex(p.purchaseDate)) return result;

  for (const item of p.recurringItems) {
    if (!isRecurringActive(item, month)) continue;
    const amount = monthlyEquivalent(item);
    if (item.kind === "income") result.income += amount;
    else result.expenses += amount;
  }
  for (const item of p.oneOffItems) {
    if (toMonthIndex(item.date) !== month) continue;
    if (item.kind === "income") result.oneOffIncome += item.amount;
    else result.oneOffExpenses += item.amount;
  }
  const mortgage = mortgageForMonth(p, month);
  result.mortgagePayment = mortgage.payment;
  result.mortgageInterest = mortgage.interest;

  const operating = result.income + result.oneOffIncome - result.expenses - result.oneOffExpenses;
  result.net = operating - result.mortgagePayment;
  result.profit = operating - result.mortgageInterest;
  return result;
}

export function sumCashFlows(flows: MonthCashFlow[]): MonthCashFlow {
  return flows.reduce((acc, f) => {
    acc.income += f.income;
    acc.expenses += f.expenses;
    acc.oneOffIncome += f.oneOffIncome;
    acc.oneOffExpenses += f.oneOffExpenses;
    acc.mortgagePayment += f.mortgagePayment;
    acc.mortgageInterest += f.mortgageInterest;
    acc.net += f.net;
    acc.profit += f.profit;
    return acc;
  }, emptyMonth());
}

/* -------------------------------- Valuation -------------------------------- */

/**
 * Estimated market value at the end of a month. Known points are the purchase, every recorded
 * valuation and the current value; months in between are linearly interpolated.
 */
export function valueAtMonth(p: PropertyData, month: number, currentMonth: number): number {
  const purchaseMonth = toMonthIndex(p.purchaseDate);
  if (month < purchaseMonth) return 0;

  const points = new Map<number, number>();
  points.set(purchaseMonth, p.purchasePrice);
  for (const v of [...p.valuations].sort((a, b) => a.date.localeCompare(b.date))) {
    const idx = toMonthIndex(v.date);
    if (idx >= purchaseMonth && idx <= currentMonth) points.set(idx, v.value);
  }
  points.set(Math.max(currentMonth, purchaseMonth), p.currentValue);

  const sorted = [...points.entries()].sort((a, b) => a[0] - b[0]);
  if (month >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [m0, v0] = sorted[i];
    const [m1, v1] = sorted[i + 1];
    if (month >= m0 && month <= m1) {
      if (m1 === m0) return v1;
      return v0 + ((v1 - v0) * (month - m0)) / (m1 - m0);
    }
  }
  return p.currentValue;
}

export interface ValuationPoint {
  month: string;
  value: number;
  change: number;
  changePct: number;
}

export function valuationHistory(
  p: PropertyData,
  months: number[],
  currentMonth: number,
): ValuationPoint[] {
  return months.map((m) => {
    const value = valueAtMonth(p, m, currentMonth);
    const previous = valueAtMonth(p, m - 1, currentMonth);
    const change = previous > 0 ? value - previous : 0;
    return {
      month: monthKey(m),
      value,
      change,
      changePct: previous > 0 ? change / previous : 0,
    };
  });
}

/* ------------------------------ Property KPIs ------------------------------ */

export interface Payback {
  /** Month (`YYYY-MM`) when cumulative profit covers the total investment. */
  month: string | null;
  achieved: boolean;
  /** Share of the total investment already recovered, 0..1. */
  progress: number;
}

function computePayback(
  target: number,
  monthlyProfits: { month: number; profit: number }[],
  projectedMonthlyProfit: number,
  currentMonth: number,
): Payback {
  if (target <= 0) return { month: null, achieved: false, progress: 0 };
  let cumulative = 0;
  for (const { month, profit } of monthlyProfits) {
    cumulative += profit;
    if (cumulative >= target) {
      return { month: monthKey(month), achieved: true, progress: 1 };
    }
  }
  const progress = Math.max(0, Math.min(1, cumulative / target));
  if (projectedMonthlyProfit <= 0) return { month: null, achieved: false, progress };
  const remaining = Math.ceil((target - cumulative) / projectedMonthlyProfit);
  return { month: monthKey(currentMonth + remaining), achieved: false, progress };
}

export interface PropertyMetrics {
  acquisitionCosts: number;
  totalInvestment: number;
  cashInvested: number;
  outstanding: number;
  equity: number;
  appreciation: number;
  appreciationPct: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyMortgagePayment: number;
  monthlyMortgageInterest: number;
  /** Rent minus operating expenses (before financing). */
  monthlyNoi: number;
  monthlyCashFlow: number;
  grossYield: number;
  netYield: number;
  cashOnCash: number;
  cumulativeProfit: number;
  monthOverMonthChange: number;
  monthOverMonthPct: number;
  payback: Payback;
}

export function propertyMetrics(p: PropertyData, now: Date): PropertyMetrics {
  const currentMonth = toMonthIndex(now);
  const purchaseMonth = toMonthIndex(p.purchaseDate);
  const current = cashFlowForMonth(p, currentMonth);

  const history = monthRange(purchaseMonth, currentMonth).map((m) => ({
    month: m,
    profit: cashFlowForMonth(p, m).profit,
  }));
  const cumulativeProfit = history.reduce((sum, h) => sum + h.profit, 0);

  const monthlyNoi = current.income - current.expenses;
  const investment = totalInvestment(p);
  const invested = cashInvested(p);
  const previousValue = valueAtMonth(p, currentMonth - 1, currentMonth);

  return {
    acquisitionCosts: acquisitionCosts(p),
    totalInvestment: investment,
    cashInvested: invested,
    outstanding: outstandingBalance(p),
    equity: equity(p),
    appreciation: p.currentValue - p.purchasePrice,
    appreciationPct: p.purchasePrice > 0 ? (p.currentValue - p.purchasePrice) / p.purchasePrice : 0,
    monthlyIncome: current.income,
    monthlyExpenses: current.expenses,
    monthlyMortgagePayment: current.mortgagePayment,
    monthlyMortgageInterest: current.mortgageInterest,
    monthlyNoi,
    monthlyCashFlow: current.income - current.expenses - current.mortgagePayment,
    grossYield: p.purchasePrice > 0 ? (current.income * 12) / p.purchasePrice : 0,
    netYield: investment > 0 ? (monthlyNoi * 12) / investment : 0,
    cashOnCash:
      invested > 0
        ? ((current.income - current.expenses - current.mortgagePayment) * 12) / invested
        : 0,
    cumulativeProfit,
    monthOverMonthChange: previousValue > 0 ? p.currentValue - previousValue : 0,
    monthOverMonthPct: previousValue > 0 ? (p.currentValue - previousValue) / previousValue : 0,
    payback: computePayback(
      investment,
      history,
      monthlyNoi - current.mortgageInterest,
      currentMonth,
    ),
  };
}

/* ------------------------------ Portfolio KPIs ----------------------------- */

export interface PortfolioMetrics {
  propertyCount: number;
  totalValue: number;
  totalInvestment: number;
  cashInvested: number;
  outstanding: number;
  equity: number;
  appreciation: number;
  appreciationPct: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyMortgagePayment: number;
  monthlyCashFlow: number;
  monthlyNoi: number;
  grossYield: number;
  netYield: number;
  /** Like-for-like growth: properties owned a year ago, value now vs then. */
  yoyGrowth: number;
  yoyGrowthPct: number;
  monthOverMonthPct: number;
  payback: Payback;
}

export function portfolioMetrics(properties: PropertyData[], now: Date): PortfolioMetrics {
  const currentMonth = toMonthIndex(now);
  const perProperty = properties.map((p) => ({ p, m: propertyMetrics(p, now) }));

  const sum = (fn: (x: (typeof perProperty)[number]) => number) =>
    perProperty.reduce((acc, x) => acc + fn(x), 0);

  const totalValue = sum(({ p }) => p.currentValue);
  const totalPurchase = sum(({ p }) => p.purchasePrice);
  const investment = sum(({ m }) => m.totalInvestment);
  const monthlyIncome = sum(({ m }) => m.monthlyIncome);
  const monthlyNoi = sum(({ m }) => m.monthlyNoi);

  let valueYearAgo = 0;
  let valueNowOfSame = 0;
  for (const { p } of perProperty) {
    if (toMonthIndex(p.purchaseDate) <= currentMonth - 12) {
      valueYearAgo += valueAtMonth(p, currentMonth - 12, currentMonth);
      valueNowOfSame += p.currentValue;
    }
  }

  const valueLastMonth = sum(({ p }) => valueAtMonth(p, currentMonth - 1, currentMonth));
  const valueNowOfLastMonth = sum(({ p }) =>
    toMonthIndex(p.purchaseDate) <= currentMonth - 1 ? p.currentValue : 0,
  );

  const earliest = properties.length
    ? Math.min(...properties.map((p) => toMonthIndex(p.purchaseDate)))
    : currentMonth;
  const history = monthRange(earliest, currentMonth).map((m) => ({
    month: m,
    profit: properties.reduce((acc, p) => acc + cashFlowForMonth(p, m).profit, 0),
  }));

  return {
    propertyCount: properties.length,
    totalValue,
    totalInvestment: investment,
    cashInvested: sum(({ m }) => m.cashInvested),
    outstanding: sum(({ m }) => m.outstanding),
    equity: sum(({ m }) => m.equity),
    appreciation: totalValue - totalPurchase,
    appreciationPct: totalPurchase > 0 ? (totalValue - totalPurchase) / totalPurchase : 0,
    monthlyIncome,
    monthlyExpenses: sum(({ m }) => m.monthlyExpenses),
    monthlyMortgagePayment: sum(({ m }) => m.monthlyMortgagePayment),
    monthlyCashFlow: sum(({ m }) => m.monthlyCashFlow),
    monthlyNoi,
    grossYield: totalPurchase > 0 ? (monthlyIncome * 12) / totalPurchase : 0,
    netYield: investment > 0 ? (monthlyNoi * 12) / investment : 0,
    yoyGrowth: valueNowOfSame - valueYearAgo,
    yoyGrowthPct: valueYearAgo > 0 ? (valueNowOfSame - valueYearAgo) / valueYearAgo : 0,
    monthOverMonthPct:
      valueLastMonth > 0 ? (valueNowOfLastMonth - valueLastMonth) / valueLastMonth : 0,
    payback: computePayback(
      investment,
      history,
      sum(({ m }) => m.monthlyNoi - m.monthlyMortgageInterest),
      currentMonth,
    ),
  };
}

export interface PortfolioValuePoint {
  month: string;
  value: number;
  invested: number;
}

export function portfolioValueSeries(
  properties: PropertyData[],
  months: number[],
  currentMonth: number,
): PortfolioValuePoint[] {
  return months.map((m) => ({
    month: monthKey(m),
    value: properties.reduce((acc, p) => acc + valueAtMonth(p, m, currentMonth), 0),
    invested: properties.reduce(
      (acc, p) => acc + (toMonthIndex(p.purchaseDate) <= m ? totalInvestment(p) : 0),
      0,
    ),
  }));
}

export interface CashFlowPoint extends MonthCashFlow {
  month: string;
}

export function cashFlowSeries(properties: PropertyData[], months: number[]): CashFlowPoint[] {
  return months.map((m) => ({
    month: monthKey(m),
    ...sumCashFlows(properties.map((p) => cashFlowForMonth(p, m))),
  }));
}

export interface YearlyValuePoint {
  year: number;
  value: number;
  growthPct: number | null;
}

/** Portfolio value at the end of each year (or the current month for this year). */
export function yearlyValueSeries(properties: PropertyData[], now: Date): YearlyValuePoint[] {
  if (!properties.length) return [];
  const currentMonth = toMonthIndex(now);
  const firstYear = Math.min(...properties.map((p) => Number(p.purchaseDate.slice(0, 4))));
  const currentYear = now.getFullYear();
  const points: YearlyValuePoint[] = [];
  for (let year = firstYear; year <= currentYear; year++) {
    const month = year === currentYear ? currentMonth : year * 12 + 11;
    const value = properties.reduce((acc, p) => acc + valueAtMonth(p, month, currentMonth), 0);
    const previous = points.at(-1);
    points.push({
      year,
      value,
      growthPct: previous && previous.value > 0 ? (value - previous.value) / previous.value : null,
    });
  }
  return points;
}
