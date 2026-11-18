import type { ConstraintKind } from './types';
import type { PublicPuzzle } from './present';

export type Streak = {
  current: number;
  best: number;
};

export type SplashResponse = {
  date: string;
  titleDate: string;
  longDate: string;
  constraintLabel: string;
  theme: string;
  riders: number;
  loggedIn: boolean;
  username: string | null;
  streak: Streak;
  completed: boolean;
  runtime: 'devvit' | 'local';
};

export type LeaderRow = {
  rank: number;
  username: string;
  length: number;
  elapsedMs: number;
  stars: number;
  you: boolean;
};

export type SolveResponse = {
  ok: true;
  length: number;
  Lstar: number;
  stars: 1 | 2 | 3;
  elapsedMs: number;
  rank: number | null;
  total: number;
  streak: Streak;
  title: string;
  loggedIn: boolean;
  saved: boolean;
  shareText: string;
  weekStars: number;
  mapName: string | null;
};

export type BoardResponse = {
  date: string;
  rows: LeaderRow[];
  you: LeaderRow | null;
};

export type GhostResponse = {
  date: string;
  path: string[];
  username: string;
};

export type WorkshopCard = {
  id: string;
  name: string;
  authorName: string;
  plays: number;
  createdAt: number;
  kind: ConstraintKind;
  stops: number;
};

export type WorkshopListResponse = {
  maps: WorkshopCard[];
};

export type ErrorBody = {
  error: string;
};

export type PuzzleResponse = {
  puzzle: PublicPuzzle;
  date: string;
  completed: boolean;
  Lstar: number | null;
  yourLength: number | null;
  yourElapsed: number | null;
  yourStars: 1 | 2 | 3 | null;
};

export type SessionResponse = {
  username: string;
  userId: string;
};

export type MeResponse = {
  loggedIn: boolean;
  username: string | null;
  userId: string | null;
  streak: Streak;
  completedTonight: boolean;
  starsTonight: number | null;
  runtime: 'devvit' | 'local';
  date: string;
};
