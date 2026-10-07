import { MOCK_NOW } from "@/mock/fixtures/catalog";

const nf = new Intl.NumberFormat("fr-FR");
const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usdPrecise = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

export const formatNumber = (n: number): string => nf.format(n);

/** 84210 → "84,2 k" */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  return nf.format(n);
}

export const formatCost = (usdValue: number): string => (usdValue < 0.1 ? usdPrecise : usd).format(usdValue);

/** 1_140_000 → "19 min" ; 9_400 → "9,4 s" */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  if (m < 60) return rs ? `${m} min ${rs} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
export const formatTime = (iso: string): string => time.format(new Date(iso));

/** Relative to the mock "now" (MOCK_NOW), so fixtures read naturally. */
export function formatRelative(iso: string): string {
  const diffSec = (new Date(iso).getTime() - MOCK_NOW.getTime()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86_400), "day");
}

export const formatPercent = (ratio: number): string =>
  `${(ratio * 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
