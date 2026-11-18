export type ZMember = { member: string; score: number };

export type Store = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  incrBy(key: string, value: number): Promise<number>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hSet(key: string, fields: Record<string, string>): Promise<void>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<void>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  zAdd(key: string, member: string, score: number): Promise<void>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zRank(key: string, member: string): Promise<number | undefined>;
  zRem(key: string, members: string[]): Promise<void>;
  zRange(key: string, start: number, stop: number, reverse?: boolean): Promise<ZMember[]>;
  zCard(key: string): Promise<number>;
};

export class MemoryStore implements Store {
  private strings = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private zsets = new Map<string, Map<string, number>>();

  async get(key: string): Promise<string | undefined> {
    return this.strings.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.strings.delete(key);
      this.hashes.delete(key);
      this.zsets.delete(key);
    }
  }

  async incrBy(key: string, value: number): Promise<number> {
    const next = Number(this.strings.get(key) ?? '0') + value;
    this.strings.set(key, String(next));
    return next;
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    return this.hashes.get(key)?.get(field);
  }

  async hSet(key: string, fields: Record<string, string>): Promise<void> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    for (const [field, value] of Object.entries(fields)) hash.set(field, value);
    this.hashes.set(key, hash);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key)?.entries() ?? []);
  }

  async hDel(key: string, fields: string[]): Promise<void> {
    const hash = this.hashes.get(key);
    if (!hash) return;
    for (const field of fields) hash.delete(field);
  }

  async hIncrBy(key: string, field: string, value: number): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    const next = Number(hash.get(field) ?? '0') + value;
    hash.set(field, String(next));
    this.hashes.set(key, hash);
    return next;
  }

  async zAdd(key: string, member: string, score: number): Promise<void> {
    const set = this.zsets.get(key) ?? new Map<string, number>();
    set.set(member, score);
    this.zsets.set(key, set);
  }

  async zScore(key: string, member: string): Promise<number | undefined> {
    return this.zsets.get(key)?.get(member);
  }

  async zRank(key: string, member: string): Promise<number | undefined> {
    const set = this.zsets.get(key);
    if (!set || !set.has(member)) return undefined;
    const ordered = [...set.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const rank = ordered.findIndex(([name]) => name === member);
    return rank < 0 ? undefined : rank;
  }

  async zRem(key: string, members: string[]): Promise<void> {
    const set = this.zsets.get(key);
    if (!set) return;
    for (const member of members) set.delete(member);
  }

  async zRange(key: string, start: number, stop: number, reverse = false): Promise<ZMember[]> {
    const set = this.zsets.get(key);
    if (!set) return [];
    const ordered = [...set.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (reverse) ordered.reverse();
    const end = stop < 0 ? ordered.length + stop : stop;
    return ordered.slice(start, end + 1).map(([member, score]) => ({ member, score }));
  }

  async zCard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  snapshot(): string {
    return JSON.stringify({
      strings: [...this.strings],
      hashes: [...this.hashes].map(([key, value]) => [key, [...value]]),
      zsets: [...this.zsets].map(([key, value]) => [key, [...value]]),
    });
  }

  restore(raw: string): void {
    const parsed = JSON.parse(raw) as {
      strings?: [string, string][];
      hashes?: [string, [string, string][]][];
      zsets?: [string, [string, number][]][];
    };
    this.strings = new Map(parsed.strings ?? []);
    this.hashes = new Map((parsed.hashes ?? []).map(([key, value]) => [key, new Map(value)]));
    this.zsets = new Map((parsed.zsets ?? []).map(([key, value]) => [key, new Map(value)]));
  }
}

export async function readJson(store: Store, key: string): Promise<unknown> {
  const raw = await store.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJson(store: Store, key: string, value: unknown): Promise<void> {
  await store.set(key, JSON.stringify(value));
}
