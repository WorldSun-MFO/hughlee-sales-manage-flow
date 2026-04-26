import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-900',
          'placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
          className
        )}
        {...props}
      />
    );
  }
);
