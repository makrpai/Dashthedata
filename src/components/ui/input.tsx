import * as React from 'react';
import { cn } from '@/lib/util/cn';

/** Inputs are inset (pressed into the surface). */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'nm-inset h-10 w-full rounded-[var(--radius-control)] px-3 text-[14px] text-fg placeholder:text-fg-2/80 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'nm-inset min-h-20 w-full rounded-[var(--radius-control)] px-3 py-2 text-[14px] text-fg placeholder:text-fg-2/80 disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-semibold text-fg-2', className)} {...props} />;
}
