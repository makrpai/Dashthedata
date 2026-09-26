import { toCanonicalString } from './values';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export interface JsonMatrix {
  /** First row = flattened keys (detected later by promoteHeader). */
  matrix: Array<Array<string | null>>;
  recordsPath: string | null;
  warnings: Array<{ key: string; params?: Record<string, string | number> }>;
}

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPrimitive = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

function getPath(value: Json, path: string): Json | undefined {
  let node: Json | undefined = value;
  for (const part of path.split('.').filter(Boolean)) {
    if (Array.isArray(node) && /^\d+$/.test(part)) node = node[Number(part)];
    else if (isObject(node)) node = node[part];
    else return undefined;
  }
  return node;
}

/** Finds the largest array of objects within depth 3 (7.4 step 3). */
function findLargestObjectArray(value: Json, path = '', depth = 0): { path: string; items: JsonObject[] } | null {
  let best: { path: string; items: JsonObject[] } | null = null;
  if (Array.isArray(value)) {
    const objects = value.filter(isObject);
    if (objects.length > 0 && objects.length >= value.length * 0.8) best = { path, items: objects };
    return best;
  }
  if (!isObject(value) || depth >= 3) return null;
  for (const [key, child] of Object.entries(value)) {
    const found = findLargestObjectArray(child, path ? `${path}.${key}` : key, depth + 1);
    if (found && (!best || found.items.length > best.items.length)) best = found;
  }
  return best;
}

/** Columnar JSON: an object with ≥ 2 equally long primitive arrays (e.g. Open-Meteo `daily`). */
function findColumnar(value: Json, path = '', depth = 0): { path: string; columns: Record<string, Json[]> } | null {
  if (!isObject(value) || depth > 3) return null;
  const arrays = Object.entries(value).filter(
    (e): e is [string, Json[]] => Array.isArray(e[1]) && e[1].every(isPrimitive),
  );
  const lengths = new Map<number, Array<[string, Json[]]>>();
  for (const e of arrays) lengths.set(e[1].length, [...(lengths.get(e[1].length) ?? []), e]);
  const group = [...lengths.values()].filter((g) => g.length >= 2 && g[0][1].length > 0).sort((a, b) => b.length - a.length)[0];
  if (group) return { path, columns: Object.fromEntries(group) };
  for (const [key, child] of Object.entries(value)) {
    const found = findColumnar(child, path ? `${path}.${key}` : key, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Flattens nested objects to dotted keys up to depth 3 (7.4). */
function flatten(
  record: JsonObject,
  out: Record<string, string | null>,
  onObjectArray: () => void,
  prefix = '',
  depth = 1,
): void {
  for (const [key, value] of Object.entries(record)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isObject(value) && depth < 3) {
      flatten(value, out, onObjectArray, name, depth + 1);
    } else if (Array.isArray(value)) {
      if (value.every(isPrimitive)) {
        out[name] = value.length ? value.map((v) => toCanonicalString(v) ?? '').join(', ') : null;
      } else {
        onObjectArray();
        out[name] = JSON.stringify(value);
      }
    } else if (isObject(value)) {
      out[name] = JSON.stringify(value);
    } else {
      out[name] = toCanonicalString(value);
    }
  }
}

/**
 * Turns parsed JSON into a string matrix whose first row is the union of flattened keys in
 * order of appearance (7.4).
 */
export function jsonToMatrix(data: unknown, recordsPath?: string): JsonMatrix {
  const root = data as Json;
  const warnings: JsonMatrix['warnings'] = [];
  let records: JsonObject[] | null = null;
  let path: string | null = null;

  if (recordsPath) {
    const node = getPath(root, recordsPath);
    if (Array.isArray(node)) {
      records = node.map((v) => (isObject(v) ? v : { value: v }));
      path = recordsPath;
    } else if (isObject(node)) {
      const columnar = findColumnar(node);
      if (columnar) return columnarMatrix(columnar.columns, recordsPath);
    }
  }
  if (!records && Array.isArray(root)) {
    records = root.map((v) => (isObject(v) ? v : { value: v }));
    path = '';
  }
  if (!records) {
    const columnar = findColumnar(root);
    const largest = findLargestObjectArray(root);
    if (columnar && (!largest || Object.values(columnar.columns)[0].length > largest.items.length)) {
      return columnarMatrix(columnar.columns, columnar.path);
    }
    if (largest) {
      records = largest.items;
      path = largest.path;
    }
  }
  if (!records) {
    records = isObject(root) ? [root] : [];
    path = '';
  }

  let objectArrays = 0;
  const keys: string[] = [];
  const seen = new Set<string>();
  const flat = records.map((r) => {
    const out: Record<string, string | null> = {};
    flatten(r, out, () => objectArrays++);
    for (const k of Object.keys(out)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
    return out;
  });
  if (objectArrays > 0) warnings.push({ key: 'ingest.warning.nestedArrays', params: { count: objectArrays } });
  const matrix: Array<Array<string | null>> = [keys, ...flat.map((r) => keys.map((k) => r[k] ?? null))];
  return { matrix, recordsPath: path, warnings };
}

function columnarMatrix(columns: Record<string, Json[]>, path: string): JsonMatrix {
  const keys = Object.keys(columns);
  const length = columns[keys[0]].length;
  const rows = Array.from({ length }, (_, i) => keys.map((k) => toCanonicalString(columns[k][i])));
  return { matrix: [keys, ...rows], recordsPath: path, warnings: [] };
}
