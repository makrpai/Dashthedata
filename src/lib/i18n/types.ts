export type Locale = 'fi' | 'en';

/** Plural forms selected with Intl.PluralRules. `other` is always required. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type DictNode = string | PluralForms | { readonly [key: string]: DictNode };

type PluralKey = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
/** A node is a plural only if it has `other` and nothing but plural-category keys. */
type IsPlural<T> = T extends { other: string }
  ? [Exclude<keyof T, PluralKey>] extends [never]
    ? true
    : false
  : false;

/** Widens the literal master dictionary into the shape every translation must have. */
export type Widen<T> = T extends string
  ? string
  : IsPlural<T> extends true
    ? PluralForms
    : { [K in keyof T]: Widen<T[K]> };

/** All dotted leaf keys of a dictionary, e.g. `nav.dashboards`. */
export type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : IsPlural<T[K]> extends true
      ? `${P}${K}`
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TParams = Record<string, string | number>;
