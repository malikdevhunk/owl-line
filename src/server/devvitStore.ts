import { redis } from '@devvit/web/server';
import type { Store } from './store';

export function devvitStore(): Store {
  return {
    get: (key) => redis.get(key),
    set: async (key, value) => {
      await redis.set(key, value);
    },
    del: async (...keys) => {
      if (keys.length > 0) await redis.del(...keys);
    },
    incrBy: (key, value) => redis.incrBy(key, value),
    hGet: (key, field) => redis.hGet(key, field),
    hSet: async (key, fields) => {
      await redis.hSet(key, fields);
    },
    hGetAll: (key) => redis.hGetAll(key),
    hDel: async (key, fields) => {
      if (fields.length > 0) await redis.hDel(key, fields);
    },
    hIncrBy: (key, field, value) => redis.hIncrBy(key, field, value),
    zAdd: async (key, member, score) => {
      await redis.zAdd(key, { member, score });
    },
    zScore: (key, member) => redis.zScore(key, member),
    zRank: (key, member) => redis.zRank(key, member),
    zRem: async (key, members) => {
      if (members.length > 0) await redis.zRem(key, members);
    },
    zRange: (key, start, stop, reverse) => redis.zRange(key, start, stop, { by: 'rank', reverse: Boolean(reverse) }),
    zCard: (key) => redis.zCard(key),
  };
}
