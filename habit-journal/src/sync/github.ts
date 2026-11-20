import type { AppData } from '../types';
import { canonical, merge, migrate } from './merge';

export interface SyncConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export class SyncError extends Error {
  constructor(message: string, public kind: 'auth' | 'not-found' | 'conflict' | 'network' | 'format' | 'other') {
    super(message);
  }
}

const API = 'https://api.github.com';

function headers(cfg: SyncConfig, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${cfg.token.trim()}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');

export function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function req(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncError('Offline or GitHub unreachable', 'network');
  }
}

async function explain(res: Response, cfg: SyncConfig): Promise<never> {
  if (res.status === 401) throw new SyncError('Token is invalid or expired', 'auth');
  if (res.status === 403) throw new SyncError('Token lacks permission (needs Contents: Read and write on this repo)', 'auth');
  if (res.status === 404) throw new SyncError(`Repo ${cfg.owner}/${cfg.repo} not found, or the token can't access it`, 'not-found');
  if (res.status === 409 || res.status === 422) throw new SyncError('Conflict: file changed on GitHub', 'conflict');
  let msg = `GitHub error ${res.status}`;
  try { msg += `: ${(await res.json()).message}`; } catch { /* ignore */ }
  throw new SyncError(msg, 'other');
}

export async function pull(cfg: SyncConfig): Promise<{ data: AppData | null; sha: string | null }> {
  const ref = cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
  const res = await req(`${API}/repos/${enc(cfg.owner)}/${enc(cfg.repo)}/contents/${enc(cfg.path)}${ref}`, { headers: headers(cfg) });
  if (res.status === 404) {
    // Distinguish "file not created yet" from "repo missing / no access".
    const repoRes = await req(`${API}/repos/${enc(cfg.owner)}/${enc(cfg.repo)}`, { headers: headers(cfg) });
    if (!repoRes.ok) await explain(repoRes, cfg);
    return { data: null, sha: null };
  }
  if (!res.ok) await explain(res, cfg);
  const body = await res.json();
  let b64: string = body.content ?? '';
  if (body.encoding === 'none' || (!b64 && body.size > 0)) {
    // Files > 1 MB: fetch the blob instead.
    const blob = await req(`${API}/repos/${enc(cfg.owner)}/${enc(cfg.repo)}/git/blobs/${body.sha}`, { headers: headers(cfg) });
    if (!blob.ok) await explain(blob, cfg);
    b64 = (await blob.json()).content;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(fromBase64Utf8(b64)); } catch { throw new SyncError(`${cfg.path} on GitHub is not valid JSON`, 'format'); }
  const data = migrate(parsed);
  if (!data) throw new SyncError(`${cfg.path} on GitHub is not a Habit Journal file`, 'format');
  return { data, sha: body.sha };
}

export async function push(cfg: SyncConfig, data: AppData, sha: string | null): Promise<string> {
  const device = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'browser';
  const body: Record<string, unknown> = {
    message: `Sync from ${device} (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`,
    content: toBase64Utf8(JSON.stringify(data, null, 1)),
  };
  if (sha) body.sha = sha;
  if (cfg.branch) body.branch = cfg.branch;
  const res = await req(`${API}/repos/${enc(cfg.owner)}/${enc(cfg.repo)}/contents/${enc(cfg.path)}`, {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await explain(res, cfg);
  return (await res.json()).content.sha;
}

/** Pull → merge → push (only if changed). Retries on concurrent writes. Returns the merged state. */
export async function sync(cfg: SyncConfig, local: AppData, attempts = 3): Promise<AppData> {
  for (let i = 0; ; i++) {
    const { data: remote, sha } = await pull(cfg);
    const merged = remote ? merge(local, remote) : local;
    if (remote && canonical(merged) === canonical(remote)) return merged;
    try {
      await push(cfg, merged, sha);
      return merged;
    } catch (e) {
      if (e instanceof SyncError && e.kind === 'conflict' && i < attempts - 1) continue;
      throw e;
    }
  }
}
