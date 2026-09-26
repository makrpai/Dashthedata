import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/util/cn';

/**
 * Buttons (17.2): primary is always filled navy; soft is raised and becomes pressed on :active;
 * ghost is flat. Every variant has a hairline border so shapes read without shadows.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-semibold transition-[transform,opacity,background-color] duration-[80ms] select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-fg border-[length:var(--line-w)] border-primary hover:opacity-90 active:translate-y-px',
        soft: 'nm-raised-sm text-fg hover:text-fg active:shadow-nm-pressed active:translate-y-px',
        ghost:
          'border-[length:var(--line-w)] border-transparent text-fg-2 hover:text-fg hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] active:shadow-nm-pressed',
        destructive:
          'border-[length:var(--line-w)] border-danger text-danger bg-transparent hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]',
        link: 'border-0 p-0 h-auto text-accent-fg underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-4',
        md: 'h-10 px-4 text-[14px] [&_svg]:size-4',
        lg: 'h-12 px-6 text-[16px] [&_svg]:size-5',
        icon: 'size-9 p-0 [&_svg]:size-4',
        iconSm: 'size-8 p-0 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'soft', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
