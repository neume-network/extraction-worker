import { RateLimiter } from "limiter";

export function populateEndpointStore(store, endpoints) {
  for (const [uri, config] of Object.entries(endpoints)) {
    const { origin } = new URL(uri);
    const limiter = new RateLimiter({
      tokensPerInterval: config.requestsPerUnit,
      interval: config.unit,
    });

    store.set(origin, { rateLimiter: limiter, timeout: config.timeout });
  }
}
