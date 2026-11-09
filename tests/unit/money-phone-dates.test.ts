import { describe, expect, it } from "vitest";
import { formatCedis, parseCedis, toDecimalString } from "@/lib/money";
import { formatGhanaPhone, normalizeGhanaPhone, whatsappLink } from "@/lib/phone";
import { addDays, daysOverdue, parseDay, toAccraDay } from "@/lib/dates";
import { csvCell, toCsv } from "@/lib/csv";
import { safeNext } from "@/lib/safe-redirect";

describe("money", () => {
  it("parses cedi strings to pesewas without float error", () => {
    expect(parseCedis("1234")).toBe(123400);
    expect(parseCedis("1,234.5")).toBe(123450);
    expect(parseCedis("GH₵ 0.10")).toBe(10);
    expect(parseCedis("GHS 20")).toBe(2000);
    expect(parseCedis("0.29")).toBe(29); // 0.29*100 = 28.999… in floats
    expect(parseCedis("19.99")).toBe(1999);
  });
  it("rejects invalid amounts", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e5", "12.3.4", "99999999999"]) expect(parseCedis(bad)).toBeNull();
  });
  it("formats GHS", () => {
    expect(formatCedis(123450)).toBe("GH₵1,234.50");
    expect(toDecimalString(-5)).toBe("-0.05");
    expect(toDecimalString(123450)).toBe("1234.50");
  });
});

describe("Ghana phone numbers", () => {
  it("normalises common formats to E.164", () => {
    for (const v of ["024 123 4567", "0241234567", "+233241234567", "233 24 123 4567", "241234567", "024-123-4567"]) {
      expect(normalizeGhanaPhone(v)).toEqual({ ok: true, e164: "+233241234567", isMobile: true });
    }
  });
  it("accepts all mobile prefixes and landlines", () => {
    for (const p of ["020", "024", "026", "027", "050", "054", "055", "056", "057", "059"]) expect(normalizeGhanaPhone(`${p}1234567`).ok).toBe(true);
    expect(normalizeGhanaPhone("0302123456")).toMatchObject({ ok: true, isMobile: false });
  });
  it("rejects invalid numbers", () => {
    for (const v of ["0123456789", "02412345", "+234241234567", "hello", "0811234567"]) expect(normalizeGhanaPhone(v).ok).toBe(false);
  });
  it("formats and links", () => {
    expect(formatGhanaPhone("+233241234567")).toBe("024 123 4567");
    expect(whatsappLink("+233241234567", "Hi & bye")).toBe("https://wa.me/233241234567?text=Hi%20%26%20bye");
  });
});

describe("dates (Africa/Accra)", () => {
  it("parses calendar days strictly", () => {
    expect(parseDay("2026-02-28")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("28/02/2026")).toBeNull();
  });
  it("computes days overdue", () => {
    const now = new Date("2026-10-14T15:00:00Z");
    expect(daysOverdue(new Date("2026-10-14T00:00:00Z"), now)).toBe(0);
    expect(daysOverdue(new Date("2026-10-10T00:00:00Z"), now)).toBe(4);
    expect(daysOverdue(new Date("2026-10-20T00:00:00Z"), now)).toBe(0);
    expect(toAccraDay(addDays(new Date("2026-12-31T23:30:00Z"), 1))).toBe("2027-01-01");
  });
});

describe("CSV", () => {
  it("escapes quotes/commas and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+233241234567")).toBe("'+233241234567");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(toCsv(["h"], [["v"]])).toBe("﻿h\r\nv\r\n");
  });
});

describe("post-login redirect", () => {
  it("allows only same-site relative paths", () => {
    expect(safeNext("/app/invoices/1")).toBe("/app/invoices/1");
    expect(safeNext("/invite/abc")).toBe("/invite/abc");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, "/x\r\nSet-Cookie: a=b"]) expect(safeNext(bad)).toBe("/app");
  });
});
