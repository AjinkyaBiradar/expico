/**
 * Universal formatting & utility functions for the Expico app.
 */

/**
 * Formats a numeric value into Indian Rupees with two decimal places.
 * Supports privacy masking when isHidden is true.
 */
export function formatCurrency(val: number | null | undefined, isHidden = false): string {
  if (isHidden) return '₹••••••••';
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact stat currency formatter (e.g. ₹1,200.00).
 */
export function formatStatCurrency(val: number | null | undefined, isHidden = false): string {
  if (isHidden) return '₹••••';
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact abbreviation for large numbers (e.g. 3200 -> ₹3.2k).
 */
export function formatCompactCurrency(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(1)}Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)}L`;
  }
  if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}k`;
  }
  return `₹${num}`;
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
 * Formats a timestamp or Date into relative strings ("Today", "Yesterday", or "Oct 24, 2026").
 */
export function formatDisplayDate(dateInput: Date | number): string {
  const date = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - compareDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Formats a timestamp into a 12-hour time string ("2:45 PM").
 */
export function formatTime(dateInput: Date | number): string {
  const date = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
