export type District = 'depot' | 'market' | 'harbor' | 'hill' | 'works' | 'stop';

export type Point = {
  x: number;
  y: number;
};

export type Stop = {
  id: string;
  name: string;
  x: number;
  y: number;
  district: District;
};

export type Edge = {
  id: string;
  a: string;
  b: string;
  /** Length in tenths of a track unit. 100 map-units = 1.0 on the board. */
  w: number;
  bridge: boolean;
};

export type ConstraintKind =
  | 'bridge_closed'
  | 'one_way'
  | 'market_first'
  | 'short_budget'
  | 'works_last';

export type OneWayArrow = {
  edgeId: string;
  from: string;
  to: string;
};

export type Constraint =
  | { kind: 'bridge_closed'; edgeId: string }
  | { kind: 'one_way'; arrows: OneWayArrow[] }
  | { kind: 'market_first' }
  | { kind: 'short_budget'; budget: number }
  | { kind: 'works_last' };

/** Full puzzle, including the optimal route. That route stays on the server. */
export type Puzzle = {
  id: string;
  date: string | null;
  seed: string;
  nodes: Stop[];
  edges: Edge[];
  river: Point[];
  constraint: Constraint;
  required: string[];
  depotId: string;
  /** Optimal length in tenths. */
  Lstar: number;
  theme: string;
  optimalPath: string[];
  mapName: string | null;
  authorName: string | null;
};

export type Playable = {
  nodes: Stop[];
  edges: Edge[];
  constraint: Constraint;
  required: string[];
  depotId: string;
};

export type DraftBody = {
  nodes: { id: string; x: number; y: number; district: District }[];
  edges: { id: string; a: string; b: string }[];
  kind: ConstraintKind;
};
