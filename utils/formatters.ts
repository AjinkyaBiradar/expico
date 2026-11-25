/**
 * Universal formatting & utility functions for the Expico app.
 */
import { getActiveCurrency } from './settings';

/**
 * Formats a numeric value into the active currency with two decimal places.
 * Supports privacy masking when isHidden is true.
 */
export function formatCurrency(val: number | null | undefined, isHidden = false): string {
  const currency = getActiveCurrency();
  if (isHidden) return `${currency.symbol}••••••••`;
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `${currency.symbol}${num.toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact stat currency formatter (e.g. ₹1,200.00 or $1,200.00).
 */
export function formatStatCurrency(val: number | null | undefined, isHidden = false): string {
  const currency = getActiveCurrency();
  if (isHidden) return `${currency.symbol}••••`;
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `${currency.symbol}${num.toLocaleString(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact abbreviation for large numbers (e.g. 3200 -> ₹3.2k).
 */
export function formatCompactCurrency(val: number | null | undefined): string {
  const currency = getActiveCurrency();
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  if (currency.code === 'INR') {
    if (num >= 10000000) {
      return `${currency.symbol}${(num / 10000000).toFixed(1)}Cr`;
    }
    if (num >= 100000) {
      return `${currency.symbol}${(num / 100000).toFixed(1)}L`;
    }
  } else {
    if (num >= 1000000000) {
      return `${currency.symbol}${(num / 1000000000).toFixed(1)}B`;
    }
    if (num >= 1000000) {
      return `${currency.symbol}${(num / 1000000).toFixed(1)}M`;
    }
  }
  if (num >= 1000) {
    return `${currency.symbol}${(num / 1000).toFixed(1)}k`;
  }
  return `${currency.symbol}${num}`;
}

/**
 * Cryptographically random UUID v4 generator with browser/Node/React Native fallback.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats a Date object or epoch milliseconds into "Feb 14, 2025".
 */
export function formatDisplayDate(dateInput: Date | number | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a Date or timestamp into a localized 12-hour time string "10:30 AM".
 */
export function formatDisplayTime(dateInput: Date | number | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
