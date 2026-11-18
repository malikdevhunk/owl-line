import { constraintLabel } from '../shared/constraints';
import { addDays, formatLongDate, formatTitleDate, isoWeek, isIsoDate, utcToday } from '../shared/dates';
import { generateDaily } from '../shared/generate';
import { dispatcherName, isDispatcherName, lineTitle } from '../shared/names';
import { presentPuzzle, type PublicPuzzle } from '../shared/present';
import { hashSeed, mulberry32 } from '../shared/prng';
import { legality } from '../shared/route';
import { clampElapsed, rankKey, shareLine, starsFor, weekKey } from '../shared/score';
import type { DraftBody, Puzzle } from '../shared/types';
import { realizeDraft } from '../shared/workshop';
import type {
  BoardResponse,
  GhostResponse,
  MeResponse,
  PuzzleResponse,
  SessionResponse,
  SolveResponse,
  SplashResponse,
  WorkshopCard,
  WorkshopListResponse,
} from '../shared/api';
import { keys } from './keys';
import type { Actor, RedditPort } from './ports';
import { EVENTS } from './ports';
import { readJson, writeJson, type Store } from './store';

type ScoreRecord = {
  userId: string;
  username: string;
  length: number;
  elapsedMs: number;
  stars: number;
  path: string[];
  at: number;
  commentId: string | null;
};

type StreakRecord = {
  current: number;
  best: number;
  lastDate: string | null;
};

type StoredMap = Puzzle & {
  authorId: string;
  createdAt: number;
  plays: number;
  hidden: boolean;
  reports: number;
};

export type Fail = { error: string };

const emptyStreak: StreakRecord = { current: 0, best: 0, lastDate: null };

function starsOf(value: number): 1 | 2 | 3 {
  if (value >= 3) return 3;
  if (value === 2) return 2;
  return 1;
}

function isPuzzle(value: unknown): value is Puzzle {
  if (!value || typeof value !== 'object') return false;
  if (!('nodes' in value) || !Array.isArray(value.nodes) || value.nodes.length < 2) return false;
  if (!('edges' in value) || !Array.isArray(value.edges)) return false;
  if (!('Lstar' in value) || typeof value.Lstar !== 'number') return false;
  if (!('depotId' in value) || typeof value.depotId !== 'string') return false;
  if (!('optimalPath' in value) || !Array.isArray(value.optimalPath)) return false;
  if (!('constraint' in value) || !value.constraint || typeof value.constraint !== 'object') return false;
  if (!('required' in value) || !Array.isArray(value.required)) return false;
  if (!('river' in value) || !Array.isArray(value.river)) return false;
  if (!('theme' in value) || typeof value.theme !== 'string') return false;
  return true;
}

function scoreFrom(value: unknown): ScoreRecord | null {
  if (!value || typeof value !== 'object') return null;
  if (!('userId' in value) || typeof value.userId !== 'string') return null;
  if (!('username' in value) || typeof value.username !== 'string') return null;
  if (!('length' in value) || typeof value.length !== 'number') return null;
  if (!('elapsedMs' in value) || typeof value.elapsedMs !== 'number') return null;
  if (!('stars' in value) || typeof value.stars !== 'number') return null;
  if (!('path' in value) || !Array.isArray(value.path) || !value.path.every((item) => typeof item === 'string')) {
    return null;
  }
  const at = 'at' in value && typeof value.at === 'number' ? value.at : 0;
  const commentId = 'commentId' in value && typeof value.commentId === 'string' ? value.commentId : null;
  return {
    userId: value.userId,
    username: value.username,
    length: value.length,
    elapsedMs: value.elapsedMs,
    stars: value.stars,
    path: value.path,
    at,
    commentId,
  };
}

function streakFrom(value: unknown): StreakRecord {
  if (!value || typeof value !== 'object') return emptyStreak;
  const current = 'current' in value && typeof value.current === 'number' ? value.current : 0;
  const best = 'best' in value && typeof value.best === 'number' ? value.best : 0;
  const lastDate = 'lastDate' in value && typeof value.lastDate === 'string' ? value.lastDate : null;
  return { current, best, lastDate };
}

function mapFrom(value: unknown): StoredMap | null {
  if (!isPuzzle(value)) return null;
  if (!('authorId' in value) || typeof value.authorId !== 'string') return null;
  if (!('createdAt' in value) || typeof value.createdAt !== 'number') return null;
  const plays = 'plays' in value && typeof value.plays === 'number' ? value.plays : 0;
  const hidden = 'hidden' in value && typeof value.hidden === 'boolean' ? value.hidden : false;
  const reports = 'reports' in value && typeof value.reports === 'number' ? value.reports : 0;
  return { ...value, authorId: value.authorId, createdAt: value.createdAt, plays, hidden, reports };
}

function advanceStreak(prev: StreakRecord, date: string): StreakRecord {
  if (prev.lastDate === date) return prev;
  const current = prev.lastDate === addDays(date, -1) ? prev.current + 1 : 1;
  return { current, best: Math.max(prev.best, current), lastDate: date };
}

async function loadScore(store: Store, date: string, userId: string): Promise<ScoreRecord | null> {
  return scoreFrom(await readJson(store, keys.score(date, userId)));
}

async function loadStreak(store: Store, userId: string): Promise<StreakRecord> {
  return streakFrom(await readJson(store, keys.streak(userId)));
}

async function loadMap(store: Store, id: string): Promise<StoredMap | null> {
  return mapFrom(await readJson(store, keys.map(id)));
}

export async function ensurePuzzle(store: Store, date: string): Promise<Puzzle> {
  const existing = await readJson(store, keys.puzzle(date));
  if (isPuzzle(existing) && existing.date === date) return existing;
  const puzzle = generateDaily(date);
  await writeJson(store, keys.puzzle(date), puzzle);
  return puzzle;
}

export function resolveDate(value: string | undefined, now = new Date()): string {
  if (value && isIsoDate(value)) return value;
  return utcToday(now);
}

export async function me(store: Store, reddit: RedditPort, actor: Actor, date: string): Promise<MeResponse> {
  const streak = actor.userId ? await loadStreak(store, actor.userId) : emptyStreak;
  const score = actor.userId ? await loadScore(store, date, actor.userId) : null;
  return {
    loggedIn: Boolean(actor.userId),
    username: actor.username,
    userId: actor.userId,
    streak: { current: streak.current, best: streak.best },
    completedTonight: Boolean(score),
    starsTonight: score ? starsOf(score.stars) : null,
    runtime: reddit.runtime,
    date,
  };
}

export async function splash(store: Store, reddit: RedditPort, actor: Actor, date: string): Promise<SplashResponse> {
  const puzzle = await ensurePuzzle(store, date);
  const profile = await me(store, reddit, actor, date);
  const riders = Number((await store.get(keys.riders(date))) ?? '0') || 0;
  return {
    date,
    titleDate: formatTitleDate(date),
    longDate: formatLongDate(date),
    constraintLabel: constraintLabel(puzzle.constraint),
    theme: puzzle.theme,
    riders,
    loggedIn: profile.loggedIn,
    username: profile.username,
    streak: profile.streak,
    completed: profile.completedTonight,
    runtime: reddit.runtime,
  };
}

export async function puzzleFor(store: Store, actor: Actor, date: string): Promise<PuzzleResponse> {
  const puzzle = await ensurePuzzle(store, date);
  const score = actor.userId ? await loadScore(store, date, actor.userId) : null;
  return {
    puzzle: presentPuzzle(puzzle),
    date,
    completed: Boolean(score),
    Lstar: score ? puzzle.Lstar : null,
    yourLength: score ? score.length : null,
    yourElapsed: score ? score.elapsedMs : null,
    yourStars: score ? starsOf(score.stars) : null,
  };
}

async function weekStars(store: Store, userId: string, date: string, stars: number, elapsedMs: number): Promise<number> {
  const week = isoWeek(date);
  const seconds = Math.round(elapsedMs / 1000);
  await store.hSet(keys.weekContrib(week, userId), { [date]: `${stars},${seconds}` });
  const all = await store.hGetAll(keys.weekContrib(week, userId));
  let starSum = 0;
  let secondSum = 0;
  for (const value of Object.values(all)) {
    const [starPart, secondPart] = value.split(',');
    starSum += Number(starPart) || 0;
    secondSum += Number(secondPart) || 0;
  }
  await store.zAdd(keys.weekBoard(week), userId, weekKey(starSum, secondSum));
  return starSum;
}

async function dropWeekDay(store: Store, userId: string, date: string): Promise<void> {
  const week = isoWeek(date);
  await store.hDel(keys.weekContrib(week, userId), [date]);
  const all = await store.hGetAll(keys.weekContrib(week, userId));
  const entries = Object.values(all);
  if (entries.length === 0) {
    await store.zRem(keys.weekBoard(week), [userId]);
    return;
  }
  let starSum = 0;
  let secondSum = 0;
  for (const value of entries) {
    const [starPart, secondPart] = value.split(',');
    starSum += Number(starPart) || 0;
    secondSum += Number(secondPart) || 0;
  }
  await store.zAdd(keys.weekBoard(week), userId, weekKey(starSum, secondSum));
}

function solvedBody(
  length: number,
  optimal: number,
  stars: 1 | 2 | 3,
  elapsedMs: number,
  rank: number | null,
  total: number,
  streak: StreakRecord,
  loggedIn: boolean,
  saved: boolean,
  week: number,
  mapName: string | null
): SolveResponse {
  return {
    ok: true,
    length,
    Lstar: optimal,
    stars,
    elapsedMs,
    rank,
    total,
    streak: { current: streak.current, best: streak.best },
    title: lineTitle(streak.current, stars),
    loggedIn,
    saved,
    shareText: shareLine(stars, length, elapsedMs),
    weekStars: week,
    mapName,
  };
}

export async function solveDaily(
  store: Store,
  reddit: RedditPort,
  actor: Actor,
  date: string,
  path: string[],
  elapsedMs: number
): Promise<SolveResponse | Fail> {
  const puzzle = await ensurePuzzle(store, date);
  const checked = legality(puzzle, path);
  if (!checked.ok) return { error: checked.reason };
  const elapsed = clampElapsed(elapsedMs, path.length - 1);
  const stars = starsFor(checked.length, puzzle.Lstar);
  const total = await store.zCard(keys.dailyBoard(date));
  if (!actor.userId || !actor.username) {
    return solvedBody(checked.length, puzzle.Lstar, stars, elapsed, null, total, emptyStreak, false, false, 0, null);
  }

  const previous = await loadScore(store, date, actor.userId);
  const nextKey = rankKey(checked.length, elapsed);
  const previousKey = await store.zScore(keys.dailyBoard(date), actor.userId);
  const improved = previousKey === undefined || nextKey < previousKey;
  let streak = await loadStreak(store, actor.userId);
  if (!previous) {
    streak = advanceStreak(streak, date);
    await writeJson(store, keys.streak(actor.userId), streak);
    await store.incrBy(keys.riders(date), 1);
    await reddit.setFlair(actor.username, lineTitle(streak.current, stars));
  }
  if (improved) {
    const record: ScoreRecord = {
      userId: actor.userId,
      username: actor.username,
      length: checked.length,
      elapsedMs: elapsed,
      stars,
      path,
      at: Date.now(),
      commentId: previous?.commentId ?? null,
    };
    await writeJson(store, keys.score(date, actor.userId), record);
    await store.zAdd(keys.dailyBoard(date), actor.userId, nextKey);
    await weekStars(store, actor.userId, date, stars, elapsed);
  }
  await store.hIncrBy(keys.events(date), 'solve', 1);
  const rank = await store.zRank(keys.dailyBoard(date), actor.userId);
  const week = isoWeek(date);
  const contrib = await store.hGetAll(keys.weekContrib(week, actor.userId));
  const weekTotal = Object.values(contrib).reduce((sum, value) => sum + (Number(value.split(',')[0]) || 0), 0);
  return solvedBody(
    checked.length,
    puzzle.Lstar,
    stars,
    elapsed,
    rank === undefined ? null : rank + 1,
    await store.zCard(keys.dailyBoard(date)),
    streak,
    true,
    true,
    weekTotal,
    null
  );
}

export async function dailyBoard(store: Store, actor: Actor, date: string): Promise<BoardResponse> {
  const top = await store.zRange(keys.dailyBoard(date), 0, 9);
  const rows = [];
  for (const [index, entry] of top.entries()) {
    const score = await loadScore(store, date, entry.member);
    if (!score) continue;
    rows.push({
      rank: index + 1,
      username: score.username,
      length: score.length,
      elapsedMs: score.elapsedMs,
      stars: score.stars,
      you: entry.member === actor.userId,
    });
  }
  let you = rows.find((row) => row.you) ?? null;
  if (!you && actor.userId) {
    const rank = await store.zRank(keys.dailyBoard(date), actor.userId);
    const score = await loadScore(store, date, actor.userId);
    if (rank !== undefined && score) {
      you = {
        rank: rank + 1,
        username: score.username,
        length: score.length,
        elapsedMs: score.elapsedMs,
        stars: score.stars,
        you: true,
      };
    }
  }
  return { date, rows, you };
}

export async function yesterdayGhost(store: Store, actor: Actor, date: string): Promise<GhostResponse | Fail> {
  if (!actor.userId) return { error: 'Log in to look back at last night.' };
  const mine = await loadScore(store, date, actor.userId);
  if (!mine) return { error: 'Finish tonight before you look at yesterday.' };
  const yesterday = addDays(date, -1);
  const best = await store.zRange(keys.dailyBoard(yesterday), 0, 0);
  const winner = best[0];
  if (!winner) return { error: 'Yesterday is still quiet.' };
  const score = await loadScore(store, yesterday, winner.member);
  if (!score) return { error: 'Yesterday is still quiet.' };
  return { date: yesterday, path: score.path, username: score.username };
}

export async function shareTime(
  store: Store,
  reddit: RedditPort,
  actor: Actor,
  date: string
): Promise<{ text: string } | Fail> {
  if (!actor.userId || !actor.username) return { error: 'Log in to post your time.' };
  const score = await loadScore(store, date, actor.userId);
  if (!score) return { error: 'Finish the night before you share it.' };
  const postId = await store.get(keys.post(date));
  if (!postId) return { error: 'Tonight’s post is not up yet.' };
  const text = shareLine(starsOf(score.stars), score.length, score.elapsedMs);
  const commentId = await reddit.commentAsUser(postId, text);
  if (!commentId) return { error: 'The comment did not post.' };
  score.commentId = commentId;
  await writeJson(store, keys.score(date, actor.userId), score);
  await store.set(keys.commentRef(commentId), JSON.stringify({ date, userId: actor.userId, kind: 'score' }));
  await store.hIncrBy(keys.events(date), 'share', 1);
  return { text };
}

export async function followNight(reddit: RedditPort, actor: Actor): Promise<{ ok: true } | Fail> {
  if (!actor.userId) return { error: 'Log in to follow the night service.' };
  await reddit.subscribe();
  return { ok: true };
}

async function requireFinish(store: Store, actor: Actor, date: string): Promise<Fail | null> {
  if (!actor.userId) return { error: 'Log in, then finish tonight, to open the workshop.' };
  const score = await loadScore(store, date, actor.userId);
  if (!score) return { error: 'Finish tonight before the workshop opens.' };
  return null;
}

function cardOf(map: StoredMap): WorkshopCard {
  return {
    id: map.id,
    name: map.mapName ?? 'Night line',
    authorName: map.authorName ?? 'dispatcher',
    plays: map.plays,
    createdAt: map.createdAt,
    kind: map.constraint.kind,
    stops: map.nodes.length,
  };
}

export async function listWorkshop(store: Store, actor: Actor, date: string): Promise<WorkshopListResponse | Fail> {
  const blocked = await requireFinish(store, actor, date);
  if (blocked) return blocked;
  const range = await store.zRange(keys.queue, 0, 60, true);
  const maps: WorkshopCard[] = [];
  for (const entry of range) {
    const map = await loadMap(store, entry.member);
    if (!map || map.hidden) continue;
    maps.push(cardOf(map));
    if (maps.length === 24) break;
  }
  return { maps };
}

export async function openWorkshopMap(
  store: Store,
  actor: Actor,
  date: string,
  id: string
): Promise<{ puzzle: PublicPuzzle } | Fail> {
  const blocked = await requireFinish(store, actor, date);
  if (blocked) return blocked;
  const map = await loadMap(store, id);
  if (!map || map.hidden) return { error: 'That line has left the yard.' };
  return { puzzle: presentPuzzle(map) };
}

export async function publishMap(
  store: Store,
  actor: Actor,
  date: string,
  draft: DraftBody
): Promise<{ map: WorkshopCard } | Fail> {
  const blocked = await requireFinish(store, actor, date);
  if (blocked) return blocked;
  if (!actor.userId || !actor.username) return { error: 'Log in to publish a line.' };
  const made = Number((await store.get(keys.dailyMaps(actor.userId, date))) ?? '0') || 0;
  if (made >= 2) return { error: 'Two lines a night is the limit.' };
  const realized = realizeDraft(draft, mulberry32(hashSeed(`${actor.userId}|${date}|${made}`)));
  if (!realized.ok) return { error: realized.error };
  const id = `m${hashSeed(`${actor.userId}|${date}|${made}|${realized.puzzle.mapName ?? ''}`).toString(36)}`;
  const stored: StoredMap = {
    ...realized.puzzle,
    id,
    authorId: actor.userId,
    authorName: actor.username,
    createdAt: Date.now(),
    plays: 0,
    hidden: false,
    reports: 0,
  };
  await writeJson(store, keys.map(id), stored);
  await store.zAdd(keys.queue, id, stored.createdAt);
  await store.incrBy(keys.dailyMaps(actor.userId, date), 1);
  await store.hIncrBy(keys.events(date), 'workshop_publish', 1);
  return { map: cardOf(stored) };
}

export async function solveWorkshop(
  store: Store,
  actor: Actor,
  date: string,
  id: string,
  path: string[],
  elapsedMs: number
): Promise<SolveResponse | Fail> {
  const blocked = await requireFinish(store, actor, date);
  if (blocked) return blocked;
  const map = await loadMap(store, id);
  if (!map || map.hidden) return { error: 'That line has left the yard.' };
  const checked = legality(map, path);
  if (!checked.ok) return { error: checked.reason };
  const elapsed = clampElapsed(elapsedMs, path.length - 1);
  const stars = starsFor(checked.length, map.Lstar);
  if (!actor.userId || !actor.username) {
    return solvedBody(checked.length, map.Lstar, stars, elapsed, null, 0, emptyStreak, false, false, 0, map.mapName);
  }
  const nextKey = rankKey(checked.length, elapsed);
  const previousKey = await store.zScore(keys.ugcBoard(id), actor.userId);
  if (previousKey === undefined || nextKey < previousKey) {
    await store.zAdd(keys.ugcBoard(id), actor.userId, nextKey);
    await writeJson(store, keys.ugcScore(id, actor.userId), {
      userId: actor.userId,
      username: actor.username,
      length: checked.length,
      elapsedMs: elapsed,
      stars,
      path,
      at: Date.now(),
      commentId: null,
    } satisfies ScoreRecord);
  }
  map.plays += 1;
  await writeJson(store, keys.map(id), map);
  const rank = await store.zRank(keys.ugcBoard(id), actor.userId);
  const streak = await loadStreak(store, actor.userId);
  return solvedBody(
    checked.length,
    map.Lstar,
    stars,
    elapsed,
    rank === undefined ? null : rank + 1,
    await store.zCard(keys.ugcBoard(id)),
    streak,
    true,
    true,
    0,
    map.mapName
  );
}

export async function deleteMap(store: Store, actor: Actor, id: string): Promise<{ ok: true } | Fail> {
  if (!actor.userId) return { error: 'Log in to take a line down.' };
  const map = await loadMap(store, id);
  if (!map) return { error: 'That line has left the yard.' };
  if (map.authorId !== actor.userId) return { error: 'Only the author can take this line down.' };
  map.hidden = true;
  await writeJson(store, keys.map(id), map);
  await store.zRem(keys.queue, [id]);
  return { ok: true };
}

export async function reportMap(store: Store, actor: Actor, id: string): Promise<{ ok: true; hidden: boolean } | Fail> {
  if (!actor.userId) return { error: 'Log in to report a line.' };
  const map = await loadMap(store, id);
  if (!map || map.hidden) return { error: 'That line has left the yard.' };
  if (map.authorId === actor.userId) return { error: 'You cannot report your own line.' };
  const already = await store.hGet(keys.reports(id), actor.userId);
  if (!already) {
    await store.hSet(keys.reports(id), { [actor.userId]: '1' });
    map.reports += 1;
    if (map.reports >= 3) {
      map.hidden = true;
      await store.zRem(keys.queue, [id]);
    }
    await writeJson(store, keys.map(id), map);
  }
  return { ok: true, hidden: map.hidden };
}

const EVENT_NAMES: readonly string[] = EVENTS;

export async function trackEvent(store: Store, date: string, name: string): Promise<{ ok: true } | Fail> {
  if (!EVENT_NAMES.includes(name)) return { error: 'Unknown event.' };
  await store.hIncrBy(keys.events(date), name, 1);
  return { ok: true };
}

export async function signLocalBook(store: Store, reddit: RedditPort): Promise<SessionResponse | Fail> {
  if (reddit.runtime !== 'local') return { error: 'The night book is only for this preview.' };
  const index = await store.incrBy(keys.dispatch, 1);
  const username = dispatcherName(index);
  if (!isDispatcherName(username)) return { error: 'Could not sign the book.' };
  return { username, userId: `local:${username}` };
}

export async function runDaily(
  store: Store,
  reddit: RedditPort,
  date: string
): Promise<{ date: string; postId: string | null; created: boolean }> {
  await ensurePuzzle(store, date);
  const existing = await store.get(keys.post(date));
  if (existing) return { date, postId: existing, created: false };
  const postId = await reddit.submitPost({
    title: `Owl Line — ${formatTitleDate(date)}`,
    date,
    fallback: `Owl Line — ${formatLongDate(date)}. Plot the last tram home. Open this post to ride tonight's map. Built and developed by Saddam Malik.`,
  });
  await store.set(keys.post(date), postId);
  await store.set(keys.postDate(postId), date);
  const commentId = await reddit.commentAsApp(
    postId,
    'No route screenshots in the clear. Use spoiler tags if you discuss a path.'
  );
  if (commentId) {
    await reddit.stickyComment(commentId);
    await store.set(keys.commentRef(commentId), JSON.stringify({ date, userId: '', kind: 'spoiler' }));
  }
  const previous = await store.get(keys.post(addDays(date, -1)));
  if (previous) await reddit.unstickyPost(previous);
  return { date, postId, created: true };
}

export async function purgePost(store: Store, postId: string): Promise<void> {
  const date = await store.get(keys.postDate(postId));
  if (date) {
    const current = await store.get(keys.post(date));
    if (current === postId) await store.del(keys.post(date));
  }
  await store.del(keys.postDate(postId));
}

export async function purgeComment(store: Store, commentId: string): Promise<void> {
  const raw = await readJson(store, keys.commentRef(commentId));
  if (raw && typeof raw === 'object' && 'kind' in raw && raw.kind === 'score') {
    const date = 'date' in raw && typeof raw.date === 'string' ? raw.date : null;
    const userId = 'userId' in raw && typeof raw.userId === 'string' ? raw.userId : null;
    if (date && userId) {
      await store.zRem(keys.dailyBoard(date), [userId]);
      await store.del(keys.score(date, userId));
      await dropWeekDay(store, userId, date);
    }
  }
  await store.del(keys.commentRef(commentId));
}
