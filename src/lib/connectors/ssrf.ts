import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata.google.com']);

/** True for loopback, link-local, private and unique-local addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0' || ip === '::') return true;
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const parts = v4.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  return false;
}

export function privateHostsAllowed(): boolean {
  return process.env.CONNECTORS_ALLOW_PRIVATE === 'true';
}

/** Rejects URLs that resolve to a private address unless private hosts are explicitly allowed. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.username || url.password) throw new Error('Credentials in the URL are not allowed');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https URLs are allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    if (!privateHostsAllowed()) throw new Error('Private hosts are blocked');
    return url;
  }
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!privateHostsAllowed() && ips.some(isPrivateAddress)) throw new Error('Private addresses are blocked');
  return url;
}

/** Same private-host rule for database servers. */
export async function assertPublicHost(host: string): Promise<void> {
  if (privateHostsAllowed()) return;
  const name = host.trim().toLowerCase();
  if (!name || BLOCKED_HOSTS.has(name) || name.endsWith('.local')) throw new Error('Private hosts are blocked');
  const ips = isIP(name) ? [name] : (await lookup(name, { all: true })).map((r) => r.address);
  if (ips.some(isPrivateAddress)) throw new Error('Private addresses are blocked');
}
