'use client';

import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'nm-raised !bg-base !text-fg !rounded-[var(--radius-control)] !border-line !font-sans !text-[14px]',
          description: '!text-fg-2',
          actionButton: '!bg-primary !text-primary-fg',
        },
      }}
    />
  );
}
