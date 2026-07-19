import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a large count with thousands separators (tabular-nums friendly). */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
