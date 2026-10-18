import type { Cache } from 'cache-manager';

/**
 * Public listing searches are cached per filter combination. Rather than
 * scanning for every filtered key, list keys embed a version number and any
 * change that affects listings bumps that version, so every cached search
 * becomes unreachable at once (old entries simply expire).
 */
const LISTINGS_VERSION_KEY = 'houses:list:version';
const VERSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function listingsCacheKey(
  cache: Cache,
  filters: unknown,
): Promise<string> {
  const version = (await cache.get<number>(LISTINGS_VERSION_KEY)) ?? 0;
  return `houses:list:v${version}:${JSON.stringify(filters)}`;
}

export async function invalidateListings(cache: Cache): Promise<void> {
  const version = (await cache.get<number>(LISTINGS_VERSION_KEY)) ?? 0;
  await cache.set(LISTINGS_VERSION_KEY, version + 1, VERSION_TTL_MS);
}

/** Clears cached details for the given houses and all cached listing searches. */
export async function invalidateHouses(
  cache: Cache,
  houseIds: string[],
): Promise<void> {
  await Promise.all(houseIds.map((id) => cache.del(`house:${id}`)));
  await invalidateListings(cache);
}
