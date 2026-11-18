import { outgoing } from './route';
import type { Playable } from './types';

type HeapItem = { cost: number; state: number };

class MinHeap {
  private data: HeapItem[] = [];

  push(item: HeapItem): void {
    this.data.push(item);
    this.up(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    const data = this.data;
    const first = data[0];
    const last = data.pop();
    if (first === undefined) return undefined;
    if (data.length === 0 || last === undefined) return first;
    data[0] = last;
    this.down(0);
    return first;
  }

  private up(index: number): void {
    const data = this.data;
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const current = data[i];
      const above = data[parent];
      if (current === undefined || above === undefined || above.cost <= current.cost) break;
      data[i] = above;
      data[parent] = current;
      i = parent;
    }
  }

  private down(index: number): void {
    const data = this.data;
    const n = data.length;
    let i = index;
    while (true) {
      let smallest = i;
      const left = i * 2 + 1;
      const right = left + 1;
      const current = data[smallest];
      if (current === undefined) break;
      if (left < n) {
        const leftItem = data[left];
        if (leftItem !== undefined && leftItem.cost < current.cost) smallest = left;
      }
      if (right < n) {
        const rightItem = data[right];
        const best = data[smallest];
        if (rightItem !== undefined && best !== undefined && rightItem.cost < best.cost) smallest = right;
      }
      if (smallest === i) break;
      const next = data[smallest];
      const here = data[i];
      if (next === undefined || here === undefined) break;
      data[smallest] = here;
      data[i] = next;
      i = smallest;
    }
  }
}

/**
 * Shortest closed walk that starts and ends at the depot and visits every
 * required stop. State is (visited mask, current stop), so the car may
 * retrace track. N is capped at 12, which keeps the search well under a
 * million states.
 */
export function solvePlayable(playable: Playable): { length: number; path: string[] } | null {
  const n = playable.nodes.length;
  if (n < 2 || n > 12) return null;
  const index = new Map<string, number>();
  playable.nodes.forEach((node, i) => index.set(node.id, i));
  const depot = index.get(playable.depotId);
  if (depot === undefined) return null;

  const requiredMask = playable.required.reduce((mask, id) => {
    const bit = index.get(id);
    return bit === undefined ? mask : mask | (1 << bit);
  }, 0);
  if (requiredMask === 0) return null;

  const marketNode = playable.nodes.find((node) => node.district === 'market');
  const marketBit = marketNode ? index.get(marketNode.id) : undefined;
  const hillBits = playable.nodes
    .filter((node) => node.district === 'hill')
    .map((node) => index.get(node.id))
    .filter((bit): bit is number => bit !== undefined);
  const worksNode = playable.nodes.find((node) => node.district === 'works');
  const worksBit = worksNode ? index.get(worksNode.id) : undefined;

  const adj: { to: number; w: number }[][] = playable.nodes.map(() => []);
  for (let from = 0; from < n; from++) {
    const fromId = playable.nodes[from]?.id;
    if (!fromId) return null;
    for (const hop of outgoing(playable, fromId)) {
      const to = index.get(hop.to);
      if (to === undefined) continue;
      const row = adj[from];
      if (!row) return null;
      row.push({ to, w: hop.edge.w });
    }
  }

  const states = n * (1 << n);
  const dist = new Int32Array(states);
  dist.fill(-1);
  const prev = new Int32Array(states);
  prev.fill(-1);

  const stateOf = (mask: number, node: number) => mask * n + node;
  const start = stateOf(1 << depot, depot);
  dist[start] = 0;
  const heap = new MinHeap();
  heap.push({ cost: 0, state: start });

  const others = requiredMask & ~(1 << depot);
  let goal = -1;

  while (true) {
    const item = heap.pop();
    if (!item) break;
    if (dist[item.state] !== item.cost) continue;
    const node = item.state % n;
    const mask = Math.floor(item.state / n);
    if (node === depot && (mask & requiredMask) === requiredMask && item.cost > 0) {
      goal = item.state;
      break;
    }
    const row: { to: number; w: number }[] | undefined = adj[node];
    if (!row) continue;
    for (const hop of row) {
      if (
        playable.constraint.kind === 'market_first' &&
        marketBit !== undefined &&
        hillBits.includes(hop.to) &&
        (mask & (1 << marketBit)) === 0
      ) {
        continue;
      }
      const nextMask = mask | (1 << hop.to);
      const finishing =
        hop.to === depot && node !== depot && (mask & others) === others && (nextMask & requiredMask) === requiredMask;
      if (playable.constraint.kind === 'works_last' && finishing && node !== worksBit) continue;
      const nextCost = item.cost + hop.w;
      const nextState = stateOf(nextMask, hop.to);
      const known = dist[nextState];
      if (known !== undefined && known !== -1 && known <= nextCost) continue;
      dist[nextState] = nextCost;
      prev[nextState] = item.state;
      heap.push({ cost: nextCost, state: nextState });
    }
  }

  if (goal < 0) return null;
  const indexes: number[] = [];
  let cursor = goal;
  let guard = 0;
  while (cursor !== -1 && guard < states + 2) {
    indexes.push(cursor % n);
    if (cursor === start) break;
    cursor = prev[cursor] ?? -1;
    guard += 1;
  }
  indexes.reverse();
  const path = indexes.map((bit) => playable.nodes[bit]?.id).filter((id): id is string => Boolean(id));
  if (path.length !== indexes.length) return null;
  const length = dist[goal];
  if (length === undefined || length < 0) return null;
  return { length, path };
}
