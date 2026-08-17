import { describe, expect, it } from "vitest";
import {
  MAX_DAY_QUARTERS,
  fromQuarters,
  isQuarterMultiple,
  snapToQuarter,
  toQuarters,
  validateDayTotal,
  validateEntryHours,
  validateRate,
} from "./validation";

describe("quarter units", () => {
  it("converts and snaps", () => {
    expect(toQuarters(2.5)).toBe(10);
    expect(fromQuarters(10)).toBe(2.5);
    expect(snapToQuarter(2.6)).toBe(2.5);
    expect(snapToQuarter(2.9)).toBe(3);
    expect(isQuarterMultiple(0.25)).toBe(true);
    expect(isQuarterMultiple(0.3)).toBe(false);
  });
});

describe("validateEntryHours (non-negative, quarter steps)", () => {
  it("accepts explicit zero", () => {
    expect(validateEntryHours(0)).toEqual({ ok: true });
  });
  it("accepts quarter multiples", () => {
    expect(validateEntryHours(7.75).ok).toBe(true);
    expect(validateEntryHours(24).ok).toBe(true);
  });
  it("rejects negatives, non-quarters, and non-numbers", () => {
    expect(validateEntryHours(-0.25).ok).toBe(false);
    expect(validateEntryHours(1.1).ok).toBe(false);
    expect(validateEntryHours(NaN).ok).toBe(false);
  });
});

describe("validateDayTotal (≤ 24h per day)", () => {
  it("caps at 24h including the candidate", () => {
    expect(validateDayTotal(0, MAX_DAY_QUARTERS).ok).toBe(true);
    expect(validateDayTotal(toQuarters(20), toQuarters(4)).ok).toBe(true);
    expect(validateDayTotal(toQuarters(20), toQuarters(4.25)).ok).toBe(false);
  });
  it("excludes the edited entry's old value by contract (caller passes others only)", () => {
    // day has 23h across other entries; editing an entry up to 1h is fine
    expect(validateDayTotal(toQuarters(23), toQuarters(1)).ok).toBe(true);
  });
});

describe("validateRate", () => {
  it("accepts 0, integers, and two decimals", () => {
    expect(validateRate(0).ok).toBe(true);
    expect(validateRate(85).ok).toBe(true);
    expect(validateRate(87.5).ok).toBe(true);
    expect(validateRate(87.55).ok).toBe(true);
  });
  it("rejects negatives and >2 decimals", () => {
    expect(validateRate(-1).ok).toBe(false);
    expect(validateRate(10.999).ok).toBe(false);
  });
});
