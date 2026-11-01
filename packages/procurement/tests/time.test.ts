import { describe, expect, it } from "vite-plus/test";

import { madridLocalToDate } from "@licita/procurement/time";

describe("Spanish local time conversion", () => {
  it("applies CET (+01:00) in winter", () => {
    expect(madridLocalToDate("2026-11-11", "14:00:00")?.toISOString()).toBe(
      "2026-11-11T13:00:00.000Z",
    );
  });

  it("applies CEST (+02:00) in summer", () => {
    expect(madridLocalToDate("2026-07-01", "14:00")?.toISOString()).toBe(
      "2026-07-01T12:00:00.000Z",
    );
  });

  it("defaults to midnight and rejects invalid dates", () => {
    expect(madridLocalToDate("2026-10-22")?.toISOString()).toBe("2026-10-21T22:00:00.000Z");
    expect(madridLocalToDate("22/10/2026")).toBeUndefined();
  });
});
