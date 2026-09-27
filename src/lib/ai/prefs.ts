'use client';

import type { AiPreferences } from '@/types/domain';

const PREFS = 'dtd:ai';
const OWN_KEY = 'dtd:ai-key';

const SERVER_PREFS: AiPreferences = {
  provider: 'claude',
  claude: { useOwnKey: false },
  browser: {},
  localServer: { baseUrl: 'http://127.0.0.1:11434', kind: 'auto', tier: 'small' },
};

const prefsListeners = new Set<() => void>();
const keyListeners = new Set<() => void>();
let prefsSnapshot: AiPreferences = SERVER_PREFS;
let prefsRaw: string | null = null;
let ownKeySnapshot = '';

export const defaultAiPrefs = (): AiPreferences => ({
  ...SERVER_PREFS,
  claude: { ...SERVER_PREFS.claude },
  browser: { ...SERVER_PREFS.browser },
  localServer: { ...SERVER_PREFS.localServer },
});

export function serverAiPrefs(): AiPreferences {
  return SERVER_PREFS;
}

function emit(listeners: Set<() => void>) {
  listeners.forEach((listener) => listener());
}

export function subscribeAiPrefs(onStoreChange: () => void): () => void {
  prefsListeners.add(onStoreChange);
  return () => prefsListeners.delete(onStoreChange);
}

export function subscribeOwnKey(onStoreChange: () => void): () => void {
  keyListeners.add(onStoreChange);
  return () => keyListeners.delete(onStoreChange);
}

export function readAiPrefs(): AiPreferences {
  if (typeof localStorage === 'undefined') return SERVER_PREFS;
  const raw = localStorage.getItem(PREFS);
  if (raw === prefsRaw) return prefsSnapshot;
  prefsRaw = raw;
  try {
    prefsSnapshot = raw ? { ...defaultAiPrefs(), ...JSON.parse(raw) } : defaultAiPrefs();
  } catch {
    prefsSnapshot = defaultAiPrefs();
  }
  return prefsSnapshot;
}

export function writeAiPrefs(prefs: AiPreferences): void {
  const raw = JSON.stringify(prefs);
  localStorage.setItem(PREFS, raw);
  prefsRaw = raw;
  prefsSnapshot = prefs;
  emit(prefsListeners);
}

export function readOwnKey(): string {
  if (typeof sessionStorage === 'undefined') return '';
  ownKeySnapshot = sessionStorage.getItem(OWN_KEY) ?? '';
  return ownKeySnapshot;
}

export function writeOwnKey(key: string): void {
  if (key) sessionStorage.setItem(OWN_KEY, key);
  else sessionStorage.removeItem(OWN_KEY);
  ownKeySnapshot = key;
  emit(keyListeners);
}
