import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[120px] w-full rounded-xl border border-zinc-200 bg-white p-4 text-base text-zinc-900',
          'placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
          'resize-y',
          className
        )}
        {...props}
      />
    );
  }
);
