import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合併 className,自動處理 Tailwind 衝突(例如 px-2 + px-4 → px-4)。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
