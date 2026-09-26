import 'server-only';
import { cookies, headers } from 'next/headers';
import { detectLocale, isLocale, type Locale } from './index';
import { LOCALE_COOKIE } from './constants';

/** Server-side locale: cookie (set by the language switch) → Accept-Language → English. */
export async function getServerLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return detectLocale((await headers()).get('accept-language'));
}
