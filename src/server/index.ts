import { serve } from '@hono/node-server';
import { context, createServer, getServerPort } from '@devvit/web/server';
import { createApp } from './app';
import { devvitReddit } from './devvitReddit';
import { devvitStore } from './devvitStore';

const app = createApp({
  store: devvitStore(),
  reddit: devvitReddit(),
  actor: () => ({
    userId: context.userId ?? null,
    username: context.username ?? null,
  }),
  postUrl: (postId) => `https://www.reddit.com/r/${context.subredditName}/comments/${postId}`,
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
