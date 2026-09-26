import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { translate } from '@/lib/i18n';
import { getServerLocale } from '@/lib/i18n/server';

export default async function NotFound() {
  const locale = await getServerLocale();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo variant="mark" size={56} />
      <h1 className="font-display text-[27px] font-bold">404</h1>
      <p className="text-fg-2">{translate(locale, 'errors.notFound')}</p>
      <Link href="/" className="font-semibold text-accent-fg underline-offset-4 hover:underline">
        {translate(locale, 'errors.notFoundAction')}
      </Link>
    </main>
  );
}
