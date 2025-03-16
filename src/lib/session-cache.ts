import { getServerSession } from 'next-auth/next';
import { NextRequest } from 'next/server';
import { authOptions } from './auth';

/**
 * Session cache entry containing the session data and timestamp
 */
interface SessionCacheEntry {
  /** The cached session object */
  session: any;
  /** Timestamp when the session was cached */
  timestamp: number;
}

// Cache duration in milliseconds (10 seconds)
const SESSION_CACHE_TTL = 10000;

// In-memory cache for sessions
const sessionCache = new Map<string, SessionCacheEntry>();

/**
 * Gets a session from cache if available, or fetches a new one
 * 
 * @param req - The Next.js request object with cookies
 * @returns The session object (cached or fresh)
 */
export async function getCachedSession(req: NextRequest) {
  // Create a cache key from the cookies
  const cookies = req.headers.get('cookie') || '';
  const cacheKey = `session_${cookies}`;
  
  const now = Date.now();
  const cached = sessionCache.get(cacheKey);
  
  // Return cached session if valid
  if (cached && now - cached.timestamp < SESSION_CACHE_TTL) {
    return cached.session;
  }
  
  // Otherwise fetch fresh session
  const session = await getServerSession(authOptions);
  
  // Cache the result
  sessionCache.set(cacheKey, {
    session,
    timestamp: now
  });
  
  return session;
}

/**
 * Clears the session cache for testing purposes
 */
export function clearSessionCache() {
  sessionCache.clear();
} 