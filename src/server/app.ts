import { Hono } from 'hono';
import type { DraftBody, District } from '../shared/types';
import {
  dailyBoard,
  deleteMap,
  followNight,
  listWorkshop,
  me,
  openWorkshopMap,
  publishMap,
  purgeComment,
  purgePost,
  puzzleFor,
  reportMap,
  resolveDate,
  runDaily,
  shareTime,
  signLocalBook,
  solveDaily,
  solveWorkshop,
  splash,
  trackEvent,
  yesterdayGhost,
  type Fail,
} from './game';
import type { Actor, RedditPort } from './ports';
import { utcToday } from '../shared/dates';
import type { Store } from './store';

const DISTRICTS = ['depot', 'market', 'harbor', 'hill', 'works', 'stop'] as const;
const KINDS = ['bridge_closed', 'one_way', 'market_first', 'short_budget', 'works_last'] as const;

function isDistrict(value: string): value is District {
  return (DISTRICTS as readonly string[]).includes(value);
}

function isKind(value: string): value is DraftBody['kind'] {
  return (KINDS as readonly string[]).includes(value);
}

export type AppDeps = {
  store: Store;
  reddit: RedditPort;
  actor: (playerHeader: string | undefined) => Actor;
  postUrl: (postId: string) => string | null;
};

function readAttempt(body: unknown): { path: string[]; elapsedMs: number } | null {
  if (!body || typeof body !== 'object' || !('path' in body) || !Array.isArray(body.path)) return null;
  if (body.path.length > 80) return null;
  if (!body.path.every((item) => typeof item === 'string' && item.length < 16)) return null;
  const elapsedMs = 'elapsedMs' in body && typeof body.elapsedMs === 'number' ? body.elapsedMs : 0;
  return { path: body.path, elapsedMs };
}

function readDraft(body: unknown): DraftBody | null {
  if (!body || typeof body !== 'object' || !('draft' in body)) return null;
  const draft = body.draft;
  if (!draft || typeof draft !== 'object') return null;
  if (!('nodes' in draft) || !Array.isArray(draft.nodes)) return null;
  if (!('edges' in draft) || !Array.isArray(draft.edges)) return null;
  if (!('kind' in draft) || typeof draft.kind !== 'string' || !isKind(draft.kind)) return null;
  const nodes: DraftBody['nodes'] = [];
  for (const node of draft.nodes) {
    if (!node || typeof node !== 'object') return null;
    if (!('id' in node) || typeof node.id !== 'string') return null;
    if (!('x' in node) || typeof node.x !== 'number') return null;
    if (!('y' in node) || typeof node.y !== 'number') return null;
    if (!('district' in node) || typeof node.district !== 'string' || !isDistrict(node.district)) return null;
    nodes.push({ id: node.id, x: node.x, y: node.y, district: node.district });
  }
  const edges: DraftBody['edges'] = [];
  for (const edge of draft.edges) {
    if (!edge || typeof edge !== 'object') return null;
    if (!('id' in edge) || typeof edge.id !== 'string') return null;
    if (!('a' in edge) || typeof edge.a !== 'string') return null;
    if (!('b' in edge) || typeof edge.b !== 'string') return null;
    edges.push({ id: edge.id, a: edge.a, b: edge.b });
  }
  return { nodes, edges, kind: draft.kind };
}

function bodyDate(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('date' in body)) return undefined;
  return typeof body.date === 'string' ? body.date : undefined;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const today = () => utcToday();

  const actor = (header: string | undefined) => deps.actor(header);

  app.get('/api/me', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    return c.json(await me(deps.store, deps.reddit, actor(c.req.header('x-owl-player')), date));
  });

  app.get('/api/splash', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    const player = actor(c.req.header('x-owl-player'));
    await trackEvent(deps.store, date, 'splash');
    return c.json(await splash(deps.store, deps.reddit, player, date));
  });

  app.get('/api/puzzle', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    return c.json(await puzzleFor(deps.store, actor(c.req.header('x-owl-player')), date));
  });

  app.post('/api/solve', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const attempt = readAttempt(body);
    if (!attempt) return c.json({ error: 'Send the route you rode.' }, 400);
    const date = resolveDate(bodyDate(body) ?? c.req.query('date'), new Date());
    const result = await solveDaily(
      deps.store,
      deps.reddit,
      actor(c.req.header('x-owl-player')),
      date,
      attempt.path,
      attempt.elapsedMs
    );
    return answer(c, result);
  });

  app.get('/api/leaderboard', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    return c.json(await dailyBoard(deps.store, actor(c.req.header('x-owl-player')), date));
  });

  app.get('/api/ghost', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    const result = await yesterdayGhost(deps.store, actor(c.req.header('x-owl-player')), date);
    return answer(c, result);
  });

  app.post('/api/share', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const date = resolveDate(bodyDate(body) ?? c.req.query('date'), new Date());
    const result = await shareTime(deps.store, deps.reddit, actor(c.req.header('x-owl-player')), date);
    return answer(c, result);
  });

  app.post('/api/subscribe', async (c) => {
    const result = await followNight(deps.reddit, actor(c.req.header('x-owl-player')));
    return answer(c, result);
  });

  app.post('/api/event', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const name = body && typeof body === 'object' && 'name' in body && typeof body.name === 'string' ? body.name : '';
    const date = resolveDate(bodyDate(body) ?? c.req.query('date'), new Date());
    const result = await trackEvent(deps.store, date, name);
    return answer(c, result);
  });

  app.post('/api/session', async (c) => {
    const result = await signLocalBook(deps.store, deps.reddit);
    return answer(c, result);
  });

  app.get('/api/workshop', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    const result = await listWorkshop(deps.store, actor(c.req.header('x-owl-player')), date);
    return answer(c, result);
  });

  app.get('/api/workshop/:id', async (c) => {
    const date = resolveDate(c.req.query('date'), new Date());
    const result = await openWorkshopMap(deps.store, actor(c.req.header('x-owl-player')), date, c.req.param('id'));
    return answer(c, result);
  });

  app.post('/api/workshop', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const draft = readDraft(body);
    if (!draft) return c.json({ error: 'That map could not be read.' }, 400);
    const date = resolveDate(bodyDate(body), new Date());
    const result = await publishMap(deps.store, actor(c.req.header('x-owl-player')), date, draft);
    return answer(c, result);
  });

  app.post('/api/workshop/:id/solve', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const attempt = readAttempt(body);
    if (!attempt) return c.json({ error: 'Send the route you rode.' }, 400);
    const date = resolveDate(bodyDate(body), new Date());
    const result = await solveWorkshop(
      deps.store,
      actor(c.req.header('x-owl-player')),
      date,
      c.req.param('id'),
      attempt.path,
      attempt.elapsedMs
    );
    return answer(c, result);
  });

  app.post('/api/workshop/:id/delete', async (c) => {
    const result = await deleteMap(deps.store, actor(c.req.header('x-owl-player')), c.req.param('id'));
    return answer(c, result);
  });

  app.post('/api/workshop/:id/report', async (c) => {
    const result = await reportMap(deps.store, actor(c.req.header('x-owl-player')), c.req.param('id'));
    return answer(c, result);
  });

  app.post('/internal/scheduler/daily-service', async (c) => {
    const result = await runDaily(deps.store, deps.reddit, today());
    return c.json({ status: 'success', ...result });
  });

  app.post('/internal/triggers/on-app-install', async (c) => {
    try {
      const result = await runDaily(deps.store, deps.reddit, today());
      return c.json({
        status: 'success',
        message: result.postId ? `Tonight is up (${result.postId}).` : 'Puzzle ready.',
      });
    } catch (error) {
      console.error('install failed', error);
      return c.json({ status: 'error', message: 'Could not post tonight.' }, 400);
    }
  });

  app.post('/internal/triggers/on-post-delete', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const postId = body && typeof body === 'object' && 'postId' in body && typeof body.postId === 'string' ? body.postId : '';
    if (postId) await purgePost(deps.store, postId);
    return c.json({ status: 'success' });
  });

  app.post('/internal/triggers/on-comment-delete', async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const commentId =
      body && typeof body === 'object' && 'commentId' in body && typeof body.commentId === 'string' ? body.commentId : '';
    if (commentId) await purgeComment(deps.store, commentId);
    return c.json({ status: 'success' });
  });

  app.post('/internal/menu/new-daily', async (c) => {
    try {
      const result = await runDaily(deps.store, deps.reddit, today());
      if (!result.postId) return c.json({ showToast: 'Could not post tonight.' }, 400);
      const url = deps.postUrl(result.postId);
      if (!url) return c.json({ showToast: result.created ? 'Tonight is posted.' : 'Tonight is already up.' });
      return c.json({ navigateTo: url });
    } catch (error) {
      console.error('menu post failed', error);
      return c.json({ showToast: 'Could not post tonight.' }, 400);
    }
  });

  return app;
}

function answer(c: { json: (body: unknown, status?: number) => Response }, result: unknown): Response {
  if (isFail(result)) return c.json(result, 400);
  return c.json(result);
}

function isFail(value: unknown): value is Fail {
  return Boolean(value && typeof value === 'object' && 'error' in value && !('ok' in value));
}
