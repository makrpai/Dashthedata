import * as React from 'react';
import { cn } from '@/lib/util/cn';

type Surface = 'raised' | 'inset' | 'flat';

const surfaceClass: Record<Surface, string> = {
  raised: 'nm-raised',
  inset: 'nm-inset',
  flat: 'nm-flat',
};

/** Card surface. Never nest a raised card inside a raised card (17.2). */
export function Card({
  surface = 'raised',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { surface?: Surface }) {
  return <div className={cn(surfaceClass[surface], 'rounded-[var(--radius-card)]', className)} {...props} />;
}
