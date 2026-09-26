import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Manrope } from 'next/font/google';
import { Providers } from '@/components/providers/Providers';
import { InlineScript } from '@/components/providers/InlineScript';
import { translate } from '@/lib/i18n';
import { getServerLocale } from '@/lib/i18n/server';
import { themeInitScript } from '@/lib/prefs';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
});
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '700'],
});
const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    title: { default: 'Dash the Data', template: '%s · Dash the Data' },
    description: translate(locale, 'app.description'),
    applicationName: 'Dash the Data',
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E9EDF4' },
    { media: '(prefers-color-scheme: dark)', color: '#16233B' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  return (
    <html
      lang={locale}
      data-theme="system"
      data-contrast="normal"
      suppressHydrationWarning
      className={`${manrope.variable} ${bricolage.variable} ${jetbrains.variable} h-full`}
    >
      <head>
        <InlineScript html={themeInitScript} />
      </head>
      <body className="min-h-full">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
