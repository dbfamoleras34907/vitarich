// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { clsx, type ClassValue } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "PHP",
  locale: string = "en-PH",
): string {
  if (isNaN(amount)) return "";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const IsBlocked = (result: any) => {
  if (result?.blocked == true) {
    toast.error(result?.message || "error");
  }
  return result?.blocked;
};

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// lib/util.ts

/**
 * Returns the current date and time as a JavaScript Date object
 */
export function getNow(): Date {
  return new Date();
}

/**
 * Returns the current date and time as an ISO string
 */
export function getNowISO(): string {
  return new Date().toISOString();
}

/**
 * Returns the current date in YYYY-MM-DD format
 */
export function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const getYear = new Date().getFullYear();
