// Tracks which userIds currently have an open socket connection.
//
// - If REDIS_URL is set, presence is stored in Redis (shared across all instances) — required
//   whenever you run more than one server process/instance (e.g. behind a load balancer).
// - If REDIS_URL is not set, presence falls back to a local in-memory count — fine for a single
//   process (local dev, or a single-instance deployment).
//
// A user may have multiple connections at once (several tabs, or several instances handling
// their reconnects), so we track a *count* per user rather than a single boolean.

const REDIS_URL = process.env.REDIS_URL;

let impl;

if (REDIS_URL) {
  const Redis = require("ioredis");
  const redis = new Redis(REDIS_URL, {
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  });

  redis.on("error", (err) => console.error("Redis (presence) error:", err.message));

  const COUNTS_KEY = "pulse:presence:counts";
  const ONLINE_KEY = "pulse:presence:online";

  impl = {
    // Returns true if this user just transitioned from offline -> online
    async addConnection(userId) {
      const count = await redis.hincrby(COUNTS_KEY, userId, 1);
      if (count === 1) {
        await redis.sadd(ONLINE_KEY, userId);
        return true;
      }
      return false;
    },
    // Returns true if this user just transitioned from online -> offline
    async removeConnection(userId) {
      const count = await redis.hincrby(COUNTS_KEY, userId, -1);
      if (count <= 0) {
        await redis.hdel(COUNTS_KEY, userId);
        await redis.srem(ONLINE_KEY, userId);
        return true;
      }
      return false;
    },
    async isOnline(userId) {
      return (await redis.sismember(ONLINE_KEY, userId)) === 1;
    },
    async onlineUserIds() {
      const ids = await redis.smembers(ONLINE_KEY);
      return ids.map(Number);
    },
  };
} else {
  const countsByUser = new Map(); // userId -> connection count

  impl = {
    async addConnection(userId) {
      const next = (countsByUser.get(userId) || 0) + 1;
      countsByUser.set(userId, next);
      return next === 1;
    },
    async removeConnection(userId) {
      const next = (countsByUser.get(userId) || 0) - 1;
      if (next <= 0) {
        countsByUser.delete(userId);
        return true;
      }
      countsByUser.set(userId, next);
      return false;
    },
    async isOnline(userId) {
      return countsByUser.has(userId);
    },
    async onlineUserIds() {
      return [...countsByUser.keys()];
    },
  };
}

module.exports = impl;
