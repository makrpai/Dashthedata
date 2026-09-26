'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createT, type Locale } from './index';

import { LOCALE_COOKIE, LOCALE_STORAGE_KEY } from './constants';

export { LOCALE_COOKIE, LOCALE_STORAGE_KEY };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // The server already picked the locale from the cookie (mirrors localStorage) or Accept-Language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used inside I18nProvider');
  return ctx;
}

export function useT() {
  const { locale } = useLocale();
  return useMemo(() => createT(locale), [locale]);
}
