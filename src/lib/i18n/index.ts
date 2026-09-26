import { en } from './en';
import { fi } from './fi';
import type { DictNode, Leaves, Locale, PluralForms, TParams, Widen } from './types';

export type { Locale, TParams } from './types';
export type Dictionary = Widen<typeof en>;
export type TKey = Leaves<typeof en>;

export const LOCALES: Locale[] = ['fi', 'en'];
export const dictionaries: Record<Locale, Dictionary> = { en, fi };

const pluralRules: Record<Locale, Intl.PluralRules> = {
  fi: new Intl.PluralRules('fi'),
  en: new Intl.PluralRules('en'),
};

export function isLocale(value: unknown): value is Locale {
  return value === 'fi' || value === 'en';
}

/** Picks a locale from an Accept-Language / navigator.language style string. */
export function detectLocale(language: string | null | undefined): Locale {
  return language && language.trim().toLowerCase().startsWith('fi') ? 'fi' : 'en';
}

function lookup(dict: Dictionary, key: string): DictNode | undefined {
  let node: DictNode | undefined = dict as unknown as DictNode;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = (node as Record<string, DictNode>)[part];
  }
  return node;
}

const PLURAL_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function isPlural(node: DictNode): node is PluralForms {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as PluralForms).other === 'string' &&
    Object.keys(node).every((k) => PLURAL_KEYS.has(k))
  );
}

/** Replaces `{name}` placeholders. Numbers are formatted for the locale. */
export function interpolate(template: string, params: TParams | undefined, locale: Locale): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
  });
}

/**
 * Translates a key. Plural forms use the `count` parameter. Unknown keys return the key itself,
 * which keeps dynamic keys (stored reasons, step descriptions) from crashing the UI.
 */
export function translate(locale: Locale, key: string, params?: TParams): string {
  const node = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key);
  if (node === undefined) return key;
  if (typeof node === 'string') return interpolate(node, params, locale);
  if (isPlural(node)) {
    const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? 0);
    const form = pluralRules[locale].select(count) as keyof PluralForms;
    return interpolate(node[form] ?? node.other, params, locale);
  }
  return key;
}

export function hasKey(locale: Locale, key: string): boolean {
  const node = lookup(dictionaries[locale], key);
  return typeof node === 'string' || (node !== undefined && isPlural(node));
}

export type TFunction = (key: TKey, params?: TParams) => string;
/** Translator for keys computed at runtime (e.g. stored `{ key, params }` pairs). */
export type TDynamic = (key: string, params?: TParams) => string;

export function createT(locale: Locale): TFunction & { dynamic: TDynamic; locale: Locale } {
  const t = ((key: TKey, params?: TParams) => translate(locale, key, params)) as TFunction & {
    dynamic: TDynamic;
    locale: Locale;
  };
  t.dynamic = (key, params) => translate(locale, key, params);
  t.locale = locale;
  return t;
}

/** Walks a dictionary and returns every leaf key with its string forms (used in tests). */
export function flattenDictionary(dict: Dictionary): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (node: DictNode, prefix: string) => {
    if (typeof node === 'string') {
      out.set(prefix, [node]);
    } else if (isPlural(node)) {
      out.set(
        prefix,
        Object.values(node).filter((v): v is string => typeof v === 'string'),
      );
    } else {
      for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k);
    }
  };
  walk(dict as unknown as DictNode, '');
  return out;
}
