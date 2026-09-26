import { cn } from '@/lib/util/cn';

/** Empty states invite action (17.6): short text plus the one thing to do next. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title?: string;
  text: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {icon && <div className="text-slate [&_svg]:size-8">{icon}</div>}
      {title && <h2 className="text-[17.5px] font-bold">{title}</h2>}
      <p className="max-w-md text-fg-2">{text}</p>
      {action}
    </div>
  );
}
