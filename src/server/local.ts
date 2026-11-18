import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { isDispatcherName } from '../shared/names';
import { createApp } from './app';
import { runDaily } from './game';
import type { RedditPort } from './ports';
import { MemoryStore } from './store';

const store = new MemoryStore();
const yard = new URL('../../.local/yard.json', import.meta.url);

async function loadYard(): Promise<void> {
  try {
    store.restore(await readFile(yard, 'utf8'));
  } catch {
    // A fresh night yard.
  }
}

let dirty = false;
function markDirty(): void {
  dirty = true;
}

async function saveYard(): Promise<void> {
  if (!dirty) return;
  await mkdir(new URL('../../.local/', import.meta.url), { recursive: true });
  await writeFile(yard, store.snapshot());
  dirty = false;
}

let commentCount = 0;

const reddit: RedditPort = {
  runtime: 'local',
  async submitPost({ date }) {
    markDirty();
    return `local_${date}`;
  },
  async commentAsApp() {
    commentCount += 1;
    return `local_note_${commentCount}`;
  },
  async stickyComment() {},
  async unstickyPost() {},
  async commentAsUser() {
    commentCount += 1;
    markDirty();
    return `local_comment_${commentCount}`;
  },
  async subscribe() {},
  async setFlair() {},
};

const app = createApp({
  store,
  reddit,
  actor: (header) => {
    if (header && isDispatcherName(header)) return { userId: `local:${header}`, username: header };
    return { userId: null, username: null };
  },
  postUrl: () => null,
});

await loadYard();
await runDaily(store, reddit, new Date().toISOString().slice(0, 10));
dirty = true;

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`Owl Line yard listening on ${info.port}`);
});

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173'], {
  stdio: 'inherit',
});

const timer = setInterval(() => {
  dirty = true;
  void saveYard();
}, 2000);

function shutdown(): void {
  clearInterval(timer);
  vite.kill();
  void saveYard().finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
