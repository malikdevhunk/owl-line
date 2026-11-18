import type {
  BoardResponse,
  GhostResponse,
  PuzzleResponse,
  SessionResponse,
  SolveResponse,
  SplashResponse,
  WorkshopListResponse,
} from '../../shared/api';
import type { PublicPuzzle } from '../../shared/present';
import type { DraftBody } from '../../shared/types';
import { onReddit } from './bridge';

const PLAYER = 'owl-line-dispatcher';

export function localPlayer(): string | null {
  try {
    return localStorage.getItem(PLAYER);
  } catch {
    return null;
  }
}

export function rememberPlayer(name: string): void {
  localStorage.setItem(PLAYER, name);
}

async function send(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');
  const player = localPlayer();
  if (player && !onReddit()) headers.set('x-owl-player', player);
  if (init?.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'The yard did not answer.';
    throw new Error(message);
  }
  return data;
}

function withDate(path: string, date?: string): string {
  if (!date) return path;
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}date=${encodeURIComponent(date)}`;
}

export function getSplash(date?: string): Promise<SplashResponse> {
  return send(withDate('/api/splash', date)) as Promise<SplashResponse>;
}

export function getPuzzle(date: string): Promise<PuzzleResponse> {
  return send(withDate('/api/puzzle', date)) as Promise<PuzzleResponse>;
}

export function postSolve(date: string, path: string[], elapsedMs: number): Promise<SolveResponse> {
  return send('/api/solve', {
    method: 'POST',
    body: JSON.stringify({ date, path, elapsedMs }),
  }) as Promise<SolveResponse>;
}

export function getBoard(date: string): Promise<BoardResponse> {
  return send(withDate('/api/leaderboard', date)) as Promise<BoardResponse>;
}

export function getGhost(date: string): Promise<GhostResponse> {
  return send(withDate('/api/ghost', date)) as Promise<GhostResponse>;
}

export function postShare(date: string): Promise<{ text: string }> {
  return send('/api/share', { method: 'POST', body: JSON.stringify({ date }) }) as Promise<{ text: string }>;
}

export function postSubscribe(): Promise<{ ok: true }> {
  return send('/api/subscribe', { method: 'POST', body: '{}' }) as Promise<{ ok: true }>;
}

export function postEvent(name: string, date: string): void {
  void fetch('/api/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, date }),
  }).catch(() => undefined);
}

export function beaconAbandon(date: string): void {
  const blob = new Blob([JSON.stringify({ name: 'abandon', date })], { type: 'application/json' });
  navigator.sendBeacon('/api/event', blob);
}

export function signBook(): Promise<SessionResponse> {
  return send('/api/session', { method: 'POST', body: '{}' }) as Promise<SessionResponse>;
}

export function getWorkshop(date: string): Promise<WorkshopListResponse> {
  return send(withDate('/api/workshop', date)) as Promise<WorkshopListResponse>;
}

export function getCommunityMap(id: string, date: string): Promise<{ puzzle: PublicPuzzle }> {
  return send(withDate(`/api/workshop/${id}`, date)) as Promise<{ puzzle: PublicPuzzle }>;
}

export function postMap(date: string, draft: DraftBody): Promise<{ map: { id: string; name: string } }> {
  return send('/api/workshop', {
    method: 'POST',
    body: JSON.stringify({ date, draft }),
  }) as Promise<{ map: { id: string; name: string } }>;
}

export function postCommunitySolve(
  id: string,
  date: string,
  path: string[],
  elapsedMs: number
): Promise<SolveResponse> {
  return send(`/api/workshop/${id}/solve`, {
    method: 'POST',
    body: JSON.stringify({ date, path, elapsedMs }),
  }) as Promise<SolveResponse>;
}

export function deleteCommunity(id: string): Promise<{ ok: true }> {
  return send(`/api/workshop/${id}/delete`, { method: 'POST', body: '{}' }) as Promise<{ ok: true }>;
}

export function reportCommunity(id: string): Promise<{ ok: true; hidden: boolean }> {
  return send(`/api/workshop/${id}/report`, { method: 'POST', body: '{}' }) as Promise<{
    ok: true;
    hidden: boolean;
  }>;
}
