import { Redis } from "ioredis";
import { env } from "./env.js";

/**
 * ioredis works with both local Redis (redis://) and Upstash (rediss://).
 * We keep three connections:
 *   - `redis`    general commands (presence, call state, rate limits)
 *   - `pubClient`/`subClient` dedicated to the Socket.IO Redis adapter
 * Separate pub/sub connections are required because a subscribed connection
 * cannot issue normal commands.
 */
/**
 * Pub/sub clients for the Socket.IO Redis adapter keep an offline queue and
 * unlimited retries so they transparently reconnect.
 */
const adapterOpts = {
  maxRetriesPerRequest: null as null,
  enableReadyCheck: true,
  lazyConnect: false,
};

/**
 * The general-purpose client must FAIL FAST when Redis is unreachable — a finite
 * retry limit + no offline queue means commands reject immediately instead of
 * hanging the request, so callers (rate-limit, presence) fail open rather than
 * blocking the API during a Redis outage.
 */
export const redis = new Redis(env.REDIS_URL, {
  ...adapterOpts,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
export const pubClient = new Redis(env.REDIS_URL, adapterOpts);
export const subClient = pubClient.duplicate();

for (const [name, client] of Object.entries({ redis, pubClient, subClient })) {
  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[redis:${name}] ${err.message}`);
  });
}
