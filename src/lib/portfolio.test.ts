import { describe, expect, it } from "vite-plus/test";

import {
  cashFlowForMonth,
  monthKey,
  mortgageForMonth,
  mortgagePayment,
  portfolioMetrics,
  portfolioValueSeries,
  propertyMetrics,
  toMonthIndex,
  valueAtMonth,
  yearlyValueSeries,
} from "./portfolio";
import type { PropertyData } from "./portfolio";

function makeProperty(overrides: Partial<PropertyData> = {}): PropertyData {
  return {
    id: "p1",
    name: "Test flat",
    type: "apartment",
    address: "Calle Mayor 1",
    city: "Madrid",
    province: "Madrid",
    purchaseDate: "2024-01-15",
    purchasePrice: 200_000,
    transferTax: 12_000,
    notaryFees: 2_000,
    agencyFees: 4_000,
    renovationCosts: 2_000,
    currentValue: 224_000,
    hasMortgage: false,
    mortgagePrincipal: 0,
    mortgageInterestRate: 0,
    mortgageTermYears: 0,
    mortgageStartDate: null,
    mortgagePaidOff: 0,
    recurringItems: [],
    oneOffItems: [],
    valuations: [],
    ...overrides,
  };
}

const NOW = new Date(2025, 0, 20); // January 2025

describe("months", () => {
  it("round-trips month indexes", () => {
    expect(monthKey(toMonthIndex("2024-03-09"))).toBe("2024-03");
    expect(toMonthIndex(new Date(2024, 2, 9))).toBe(toMonthIndex("2024-03-01"));
  });
});

describe("mortgage", () => {
  it("computes a standard annuity payment", () => {
    // 150k at 3% over 25 years is ~711.32/month
    expect(mortgagePayment(150_000, 3, 25)).toBeCloseTo(711.32, 1);
  });

  it("handles a zero interest rate", () => {
    expect(mortgagePayment(120_000, 0, 10)).toBe(1_000);
  });

  it("returns first-month interest on the full principal", () => {
    const p = makeProperty({
      hasMortgage: true,
      mortgagePrincipal: 120_000,
      mortgageInterestRate: 3,
      mortgageTermYears: 30,
      mortgageStartDate: "2024-01-15",
    });
    const first = mortgageForMonth(p, toMonthIndex("2024-01-01"));
    expect(first.interest).toBeCloseTo(300, 5);
    const later = mortgageForMonth(p, toMonthIndex("2024-12-01"));
    expect(later.interest).toBeLessThan(first.interest);
    expect(mortgageForMonth(p, toMonthIndex("2023-12-01")).payment).toBe(0);
  });
});

describe("cash flow", () => {
  it("normalises recurring items and adds one-offs", () => {
    const p = makeProperty({
      recurringItems: [
        {
          id: "r1",
          kind: "income",
          category: "rent",
          label: "Rent",
          amount: 1_200,
          frequency: "monthly",
          startDate: "2024-02-01",
          endDate: null,
        },
        {
          id: "r2",
          kind: "expense",
          category: "tax",
          label: "IBI",
          amount: 600,
          frequency: "yearly",
          startDate: "2024-01-01",
          endDate: null,
        },
      ],
      oneOffItems: [
        {
          id: "o1",
          kind: "expense",
          category: "repairs",
          label: "Boiler",
          amount: 900,
          date: "2024-06-10",
        },
      ],
    });

    const jan = cashFlowForMonth(p, toMonthIndex("2024-01-01"));
    expect(jan.income).toBe(0);
    expect(jan.expenses).toBe(50);

    const june = cashFlowForMonth(p, toMonthIndex("2024-06-01"));
    expect(june.income).toBe(1_200);
    expect(june.oneOffExpenses).toBe(900);
    expect(june.net).toBe(1_200 - 50 - 900);

    expect(cashFlowForMonth(p, toMonthIndex("2023-12-01")).net).toBe(0);
  });
});

describe("valuation", () => {
  it("interpolates between purchase, recorded valuations and current value", () => {
    const p = makeProperty({
      purchaseDate: "2024-01-01",
      purchasePrice: 200_000,
      currentValue: 212_000,
      valuations: [{ id: "v1", date: "2024-07-01", value: 206_000 }],
    });
    const current = toMonthIndex(NOW);
    expect(valueAtMonth(p, toMonthIndex("2023-12-01"), current)).toBe(0);
    expect(valueAtMonth(p, toMonthIndex("2024-01-01"), current)).toBe(200_000);
    expect(valueAtMonth(p, toMonthIndex("2024-04-01"), current)).toBe(203_000);
    expect(valueAtMonth(p, toMonthIndex("2024-07-01"), current)).toBe(206_000);
    expect(valueAtMonth(p, current, current)).toBe(212_000);
  });

  it("builds a portfolio value series", () => {
    const p = makeProperty({ purchaseDate: "2024-06-01" });
    const current = toMonthIndex(NOW);
    const series = portfolioValueSeries([p], [current - 8, current], current);
    expect(series[0].value).toBe(0);
    expect(series[1].value).toBe(224_000);
    expect(series[1].invested).toBe(220_000);
  });
});

describe("metrics", () => {
  const rent = {
    id: "r1",
    kind: "income" as const,
    category: "rent",
    label: "Rent",
    amount: 1_000,
    frequency: "monthly" as const,
    startDate: "2024-01-01",
    endDate: null,
  };
  const fees = {
    id: "r2",
    kind: "expense" as const,
    category: "community",
    label: "Community fees",
    amount: 100,
    frequency: "monthly" as const,
    startDate: "2024-01-01",
    endDate: null,
  };

  it("derives yields, equity and payback for a cash purchase", () => {
    const p = makeProperty({ recurringItems: [rent, fees] });
    const m = propertyMetrics(p, NOW);
    expect(m.totalInvestment).toBe(220_000);
    expect(m.acquisitionCosts).toBe(20_000);
    expect(m.grossYield).toBeCloseTo(0.06, 6);
    expect(m.netYield).toBeCloseTo((900 * 12) / 220_000, 6);
    expect(m.equity).toBe(224_000);
    // 13 months (Jan 2024 → Jan 2025) of 900 profit
    expect(m.cumulativeProfit).toBe(900 * 13);
    expect(m.payback.achieved).toBe(false);
    const remainingMonths = Math.ceil((220_000 - 900 * 13) / 900);
    expect(m.payback.month).toBe(monthKey(toMonthIndex(NOW) + remainingMonths));
  });

  it("reports no payback date when the property loses money", () => {
    const p = makeProperty({ recurringItems: [fees] });
    expect(propertyMetrics(p, NOW).payback.month).toBeNull();
  });

  it("accounts for the mortgage in equity and cash flow", () => {
    const p = makeProperty({
      recurringItems: [rent],
      hasMortgage: true,
      mortgagePrincipal: 150_000,
      mortgageInterestRate: 3,
      mortgageTermYears: 25,
      mortgageStartDate: "2024-01-15",
      mortgagePaidOff: 4_000,
    });
    const m = propertyMetrics(p, NOW);
    expect(m.outstanding).toBe(146_000);
    expect(m.equity).toBe(224_000 - 146_000);
    expect(m.cashInvested).toBe(70_000);
    expect(m.monthlyCashFlow).toBeCloseTo(1_000 - 711.32, 1);
  });

  it("computes like-for-like year-over-year growth", () => {
    const old = makeProperty({
      id: "a",
      purchaseDate: "2023-01-01",
      purchasePrice: 100_000,
      currentValue: 110_000,
      valuations: [{ id: "v", date: "2024-01-01", value: 100_000 }],
    });
    const recent = makeProperty({ id: "b", purchaseDate: "2024-10-01" });
    const m = portfolioMetrics([old, recent], NOW);
    expect(m.propertyCount).toBe(2);
    expect(m.yoyGrowth).toBe(10_000);
    expect(m.yoyGrowthPct).toBeCloseTo(0.1, 6);
    expect(m.totalValue).toBe(110_000 + 224_000);
  });

  it("returns yearly values with growth", () => {
    const p = makeProperty({
      purchaseDate: "2023-01-01",
      purchasePrice: 100_000,
      currentValue: 121_000,
      valuations: [{ id: "v", date: "2023-12-01", value: 110_000 }],
    });
    const years = yearlyValueSeries([p], new Date(2024, 11, 5));
    expect(years.map((y) => y.year)).toEqual([2023, 2024]);
    expect(years[0].value).toBe(110_000);
    expect(years[1].growthPct).toBeCloseTo(0.1, 6);
  });
});
