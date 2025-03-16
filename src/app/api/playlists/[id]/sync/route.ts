import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Playlist from '@/models/Playlist';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession } from '@/lib/session-cache';

// Simple in-memory cache for YouTube API responses
// In production, this should be replaced with Redis or another distributed cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const youtubeCache = new Map<string, CacheEntry>();

/**
 * Gets data from cache or fetches it if not cached or expired
 * 
 * @param cacheKey - Unique key for the cache entry
 * @param fetchFn - Function to fetch data if not in cache
 * @param ttl - Optional custom TTL in milliseconds
 * @returns The cached or freshly fetched data
 */
async function getCachedOrFetch(
  cacheKey: string, 
  fetchFn: () => Promise<any>,
  ttl = CACHE_TTL
): Promise<any> {
  const now = Date.now();
  const cached = youtubeCache.get(cacheKey);
  
  // Return cached data if valid and not expired
  if (cached && (now - cached.timestamp) < ttl) {
    console.log(`Using cached data for: ${cacheKey}`);
    return cached.data;
  }
  
  // Fetch fresh data
  console.log(`Fetching fresh data for: ${cacheKey}`);
  const data = await fetchFn();
  
  // Cache the result
  youtubeCache.set(cacheKey, {
    data,
    timestamp: now
  });
  
  return data;
}

/**
 * Performs a YouTube API request with quota handling and exponential backoff retries
 * 
 * @param url - The YouTube API endpoint URL
 * @param accessToken - The OAuth access token
 * @param options - Additional fetch options
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param useCache - Whether to use caching (default: true)
 * @returns The API response
 */
async function fetchYouTubeWithQuotaHandling(
  url: string,
  accessToken: string | null,
  options: RequestInit = {},
  maxRetries = 3,
  useCache = true
): Promise<Response> {
  // Use cache if enabled and it's a GET request
  if (useCache && (!options.method || options.method === 'GET')) {
    const cacheKey = `youtube-api:${url}`;
    
    try {
      const cachedResponse = await getCachedOrFetch(
        cacheKey,
        async () => {
          const response = await fetchYouTubeWithRetries(url, accessToken, options, maxRetries);
          
          // Only cache successful responses
          if (response.ok) {
            const clonedResponse = response.clone();
            return {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: await clonedResponse.json()
            };
          }
          
          // For error responses, don't cache but return as is
          throw new Error(`API error: ${response.status}`);
        }
      );
      
      // Convert cached data back to a Response object
      return new Response(
        JSON.stringify(cachedResponse.body),
        {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: cachedResponse.headers
        }
      );
    } catch (error) {
      // If any error occurs with caching, fall back to direct API call
      console.warn(`Cache error, falling back to direct API call: ${error}`);
      return fetchYouTubeWithRetries(url, accessToken, options, maxRetries);
    }
  }
  
  // For non-GET requests or when cache is disabled
  return fetchYouTubeWithRetries(url, accessToken, options, maxRetries);
}

/**
 * Helper function with the actual retry logic for YouTube API requests
 */
async function fetchYouTubeWithRetries(
  url: string,
  accessToken: string | null,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  let currentRetry = 0;
  
  // Check if token has known issues and immediately use API key if possible
  if ((accessToken === null || accessToken === undefined || 
      accessToken.length < 10) && process.env.YOUTUBE_API_KEY) {
    console.log('Access token invalid or missing, using API key directly');
    const hasParams = url.includes('?');
    const separator = hasParams ? '&' : '?';
    const apiKeyUrl = `${url}${separator}key=${process.env.YOUTUBE_API_KEY}`;
    
    // Create headers without auth
    const headersWithoutAuth: HeadersInit = { ...options.headers as Record<string, string> || {} };
    delete (headersWithoutAuth as Record<string, string>)['Authorization'];
    
    return fetch(apiKeyUrl, {
      ...options,
      headers: headersWithoutAuth
    });
  }
  
  while (currentRetry <= maxRetries) {
    try {
      // Determine if we should use OAuth token or API key
      let updatedUrl = url;
      const headers: HeadersInit = { ...options.headers as Record<string, string> || {} };
      
      if (accessToken) {
        // Use OAuth token authentication
        (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
      } else if (process.env.YOUTUBE_API_KEY) {
        // Use API key authentication
        // Check if URL already has parameters
        const hasParams = url.includes('?');
        const separator = hasParams ? '&' : '?';
        updatedUrl = `${url}${separator}key=${process.env.YOUTUBE_API_KEY}`;
      }
      
      const response = await fetch(updatedUrl, {
        ...options,
        headers
      });
      
      // If quota exceeded, implement exponential backoff
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        
        if (errorData?.error?.errors?.some((e: any) => e.domain === 'youtube.quota')) {
          console.warn(`YouTube quota exceeded. Retry ${currentRetry + 1}/${maxRetries}`);
          
          if (currentRetry < maxRetries) {
            // Exponential backoff with jitter: wait longer after each retry
            // Add some randomness to avoid thundering herd problem
            const jitter = Math.random() * 1000;
            const backoffTime = Math.pow(2, currentRetry) * 1000 + jitter;
            console.log(`Backing off for ${backoffTime}ms before retry ${currentRetry + 1}`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            currentRetry++;
            continue;
          } else {
            // Out of retries, create a response with quota error
            return new Response(
              JSON.stringify({
                error: {
                  message: 'YouTube API quota exceeded. Please try again later.',
                  domain: 'youtube.quota'
                }
              }),
              { status: 429 }
            );
          }
        }
        
        // Handle auth failure cases
        if (errorData?.error === 'unauthorized_client' || 
            errorData?.error_description === 'Unauthorized' ||
            (errorData?.error?.errors && errorData.error.errors.some((e: any) => 
              e.reason === 'authError' || e.reason === 'forbidden'))) {
          console.log('YouTube OAuth token error detected, attempting API key fallback');
          // Fall through to the API key fallback below
        }
      }
      
      // If there's an authentication error and we have an API key but didn't use it,
      // fall back to using the API key
      if ((response.status === 401 || response.status === 403) && 
          accessToken && process.env.YOUTUBE_API_KEY &&
          !updatedUrl.includes(`key=${process.env.YOUTUBE_API_KEY}`)) {
        console.log(`YouTube authentication error (${response.status}), falling back to API key...`);
        
        // Add API key to URL
        const hasParams = url.includes('?');
        const separator = hasParams ? '&' : '?';
        const apiKeyUrl = `${url}${separator}key=${process.env.YOUTUBE_API_KEY}`;
        
        // Try again without the auth header
        const headersWithoutAuth: Record<string, string> = { ...(headers as Record<string, string>) };
        delete headersWithoutAuth['Authorization'];
        
        const apiKeyResponse = await fetch(apiKeyUrl, {
          ...options,
          headers: headersWithoutAuth
        });
        
        if (apiKeyResponse.ok) {
          console.log('Successfully fell back to YouTube API key');
          return apiKeyResponse;
        } else {
          console.log(`API key fallback also failed: ${apiKeyResponse.status}`);
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error in YouTube API call:', error);
      
      if (currentRetry < maxRetries) {
        currentRetry++;
        const jitter = Math.random() * 1000;
        const backoffTime = Math.pow(2, currentRetry) * 1000 + jitter;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        throw error;
      }
    }
  }
  
  // This should never execute, but TypeScript requires a return
  throw new Error('Failed to complete YouTube API request after retries');
}

/**
 * Syncs a playlist across connected platforms
 * @param request - The incoming request
 * @param params - Object containing the playlist ID
 * @returns JSON response indicating sync status
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Starting sync for playlist ${params.id}`);
    
    // Check if user is authenticated - use cached session
    const session = await getCachedSession(request);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }
    
    // Log token presence (without sensitive values)
    console.log('Token status:', {
      hasSpotifyToken: !!session.user.spotifyAccessToken,
      hasGoogleToken: !!session.user.googleAccessToken,
      googleTokenError: (session.user as any).googleError || 'none'
    });
    
    // Check for Google token errors
    let googleTokenIssue = false;
    if ((session.user as any).googleError === 'RefreshAccessTokenError') {
      console.warn('Google refresh token error detected. Will try to use API key fallback if available.');
      googleTokenIssue = true;
    }
    
    // Connect to database and find playlist
    const { db } = await connectToDatabase();
    const playlistId = params.id;
    
    // Fetch the playlist data
    // ... existing code ...

    // Validate playlist ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: 'Invalid playlist ID' },
        { status: 400 }
      );
    }

    // Find the playlist and ensure it belongs to the current user
    const playlist = await Playlist.findOne({
      _id: params.id,
      userId: session.user.id
    });
    
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    // Extract platform query parameter
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    const result: any = { success: false };

    // Sync with the specified platform, or all connected platforms if none specified
    if (!platform || platform === 'spotify') {
      // Check if the user has a Spotify access token
      if (!session.user.spotifyAccessToken) {
        result.spotify = { 
          status: 'failed', 
          message: 'No Spotify access token available',
          success: false
        };
      } else {
        // Check if playlist is connected to Spotify
        const spotifyPlatformData = playlist.platformData?.find((data: any) => data.platform === 'spotify');
        
        if (spotifyPlatformData) {
          console.log('Syncing as Spotify user:', spotifyPlatformData.platformId);
          result.spotify = await syncToSpotify(playlist, session.user.spotifyAccessToken, playlist, session);
          
          // Add Spotify URL to the result if not already included
          if (result.spotify.success && !result.spotify.spotifyUrl && spotifyPlatformData.id) {
            result.spotify.spotifyUrl = `https://open.spotify.com/playlist/${spotifyPlatformData.id}`;
          }
        } else {
          // Create a new playlist on Spotify
          console.log('Playlist not connected to Spotify, creating new playlist');
          
          try {
            // Create a new Spotify playlist
            const createResponse = await fetch('https://api.spotify.com/v1/me/playlists', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.user.spotifyAccessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: playlist.name,
                description: playlist.description || `Playlist synced from Musync`,
                public: !!playlist.isPublic
              })
            });
            
            if (!createResponse.ok) {
              throw new Error(`Failed to create Spotify playlist: ${await createResponse.text()}`);
            }
            
            const createData = await createResponse.json();
            const spotifyPlaylistId = createData.id;
            
            // Update the playlist with the new Spotify platform data
            await Playlist.findByIdAndUpdate(
              playlist._id,
              {
                $push: {
                  platformData: {
                    platform: 'spotify',
                    id: spotifyPlaylistId,
                    syncStatus: 'pending',
                    lastSyncedAt: new Date()
                  }
                },
                $set: {
                  spotifyId: spotifyPlaylistId
                }
              }
            );
            
            // Refresh the playlist object with the updated data
            const updatedPlaylist = await Playlist.findById(playlist._id);
            
            if (!updatedPlaylist) {
              throw new Error('Failed to update playlist with Spotify ID');
            }
            
            // Sync the playlist with the newly created Spotify playlist
            result.spotify = await syncToSpotify(updatedPlaylist, session.user.spotifyAccessToken, updatedPlaylist, session);
            
            // Add created flag and Spotify URL to the result
            if (result.spotify.success) {
              result.spotify.created = true;
              result.spotify.spotifyUrl = `https://open.spotify.com/playlist/${spotifyPlaylistId}`;
            }
          } catch (error) {
            console.error('Error creating Spotify playlist:', error);
            result.spotify = {
              status: 'failed',
              message: `Failed to create Spotify playlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
              success: false
            };
          }
        }
      }
    }

    if (!platform || platform === 'youtube') {
      // Check if the user has a Google access token
      if (!session.user.googleAccessToken) {
        result.youtube = { 
          status: 'failed', 
          message: 'No Google access token available',
          success: false
        };
      } else {
        // Check if playlist is connected to YouTube
        const youtubePlatformData = playlist.platformData?.find((data: any) => data.platform === 'youtube');
        
        if (youtubePlatformData) {
          console.log('Syncing with YouTube as user:', session.user.name);
          result.youtube = await syncToYouTube(playlist, session, playlist);
          
          // Add YouTube URL to the result if not already included
          if (result.youtube.success && !result.youtube.youtubeUrl && youtubePlatformData.id) {
            result.youtube.youtubeUrl = `https://www.youtube.com/playlist?list=${youtubePlatformData.id}`;
          }
        } else {
          // Create a new playlist on YouTube
          console.log('Playlist not connected to YouTube, creating new playlist');
          
          try {
            // Use the YouTube API to create a new playlist
            const userResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
              headers: {
                Authorization: `Bearer ${session.user.googleAccessToken}`
              }
            });
            
            if (!userResponse.ok) {
              throw new Error(`Failed to fetch YouTube user data: ${await userResponse.text()}`);
            }
            
            const userData = await userResponse.json();
            
            if (!userData.items || userData.items.length === 0) {
              throw new Error('No YouTube channel found for user');
            }
            
            const createResponse = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.user.googleAccessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                snippet: {
                  title: playlist.name,
                  description: playlist.description || `Playlist synced from Musync`
                },
                status: {
                  privacyStatus: playlist.isPublic ? 'public' : 'private'
                }
              })
            });
            
            if (!createResponse.ok) {
              throw new Error(`Failed to create YouTube playlist: ${await createResponse.text()}`);
            }
            
            const createData = await createResponse.json();
            const youtubePlaylistId = createData.id;
            
            // Update the playlist with the new YouTube platform data
            await Playlist.findByIdAndUpdate(
              playlist._id,
              {
                $push: {
                  platformData: {
                    platform: 'youtube',
                    id: youtubePlaylistId,
                    syncStatus: 'pending',
                    lastSyncedAt: new Date()
                  }
                },
                $set: {
                  youtubeId: youtubePlaylistId
                }
              }
            );
            
            // Refresh the playlist object with the updated data
            const updatedPlaylist = await Playlist.findById(playlist._id);
            
            if (!updatedPlaylist) {
              throw new Error('Failed to update playlist with YouTube ID');
            }
            
            // Sync the playlist with the newly created YouTube playlist
            result.youtube = await syncToYouTube(updatedPlaylist, session, updatedPlaylist);
            
            // Add created flag and YouTube URL to the result
            if (result.youtube.success) {
              result.youtube.created = true;
              result.youtube.youtubeUrl = `https://www.youtube.com/playlist?list=${youtubePlaylistId}`;
            }
          } catch (error) {
            console.error('Error creating YouTube playlist:', error);
            result.youtube = {
              status: 'failed',
              message: `Failed to create YouTube playlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
              success: false
            };
          }
        }
      }
    }
    
    // Set overall success flag
    result.success = true;
    
    // Include platform URLs in the top-level result for easier access
    if (!result.platformUrls) {
      result.platformUrls = {};
      
      // Add Spotify URL if available
      const spotifyId = playlist.spotifyId || playlist.platformData?.find((data: any) => data.platform === 'spotify')?.id;
      if (spotifyId) {
        result.platformUrls.spotify = `https://open.spotify.com/playlist/${spotifyId}`;
      }
      
      // Add YouTube URL if available
      const youtubeId = playlist.youtubeId || playlist.platformData?.find((data: any) => data.platform === 'youtube')?.id;
      if (youtubeId) {
        result.platformUrls.youtube = `https://www.youtube.com/playlist?list=${youtubeId}`;
      }
    }

    // Always ensure we have platform information in the response
    const spotifyUrlForResult = result.spotify?.spotifyUrl || result.spotify?.playlistUrl || 
      (playlist.spotifyId ? `https://open.spotify.com/playlist/${playlist.spotifyId}` : undefined);
      
    const youtubeUrlForResult = result.youtube?.youtubeUrl || result.youtube?.playlistUrl || 
      (playlist.youtubeId ? `https://www.youtube.com/playlist?list/${playlist.youtubeId}` : undefined);

    // Extract YouTube and Spotify IDs from playlist
    console.log("PLAYLIST BEFORE RESPONSE:", {
      spotifyId: playlist.spotifyId,
      youtubeId: playlist.youtubeId,
      platformData: playlist.platformData
    });

    // Also add information about which platforms were successful, regardless of whether they were requested
    const platformSuccess = {
      spotify: result.spotify?.success === true || result.spotify?.status === 'success' || !!playlist.spotifyId,
      youtube: result.youtube?.success === true || result.youtube?.status === 'success' || !!playlist.youtubeId
    };

    // Prepare platform URLs in a very direct way
    const platformUrlsForResponse = {
      spotify: spotifyUrlForResult,
      youtube: youtubeUrlForResult
    };

    // Ensure we have values for both URLs if the IDs exist
    if (playlist.spotifyId && !platformUrlsForResponse.spotify) {
      platformUrlsForResponse.spotify = `https://open.spotify.com/playlist/${playlist.spotifyId}`;
    }

    if (playlist.youtubeId && !platformUrlsForResponse.youtube) {
      platformUrlsForResponse.youtube = `https://www.youtube.com/playlist?list/${playlist.youtubeId}`;
    }

    console.log("RESPONSE URLs:", {
      spotifyUrl: spotifyUrlForResult,
      youtubeUrl: youtubeUrlForResult,
      platformUrls: platformUrlsForResponse
    });

    // Return success response with platform URLs
    return NextResponse.json({
      success: true,
      message: 'Playlist synchronized successfully',
      // Make sure both URLs are included
      spotifyUrl: spotifyUrlForResult,
      youtubeUrl: youtubeUrlForResult,
      // Include platform URLs for easier access
      platformUrls: platformUrlsForResponse,
      syncResult: {
        spotify: result.spotify || { success: playlist.spotifyId ? true : false, message: playlist.spotifyId ? 'Successfully synced' : 'Spotify sync not attempted' },
        youtube: result.youtube || { success: playlist.youtubeId ? true : false, message: playlist.youtubeId ? 'Successfully synced' : 'YouTube sync not attempted' }
      },
      // Add detailed information about which platforms succeeded and failed
      platforms: platformSuccess,
      // If only one platform was attempted, make that clear
      targetPlatform: platform || 'all'
    });
  } catch (error) {
    console.error('Error syncing playlist:', error);
    return NextResponse.json(
      { error: `Failed to sync playlist: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * Searches for a track on Spotify by title and artist
 * 
 * @param accessToken - Spotify access token
 * @param title - Track title
 * @param artist - Track artist
 * @returns Spotify track ID and URI if found, null otherwise
 */
async function searchSpotify(accessToken: string, title: string, artist: string): Promise<{ id: string, uri: string } | null> {
  try {
    // Create a search query with both title and artist for better results
    const query = encodeURIComponent(`track:${title} artist:${artist}`);
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      console.error(`Spotify search failed: ${await response.text()}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.tracks?.items && data.tracks.items.length > 0) {
      const track = data.tracks.items[0];
      return {
        id: track.id,
        uri: track.uri
      };
    }
    
    // If not found with strict search, try a more lenient search (just the title)
    const lenientQuery = encodeURIComponent(title);
    
    const lenientResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${lenientQuery}&type=track&limit=3`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    if (!lenientResponse.ok) {
      console.error(`Spotify lenient search failed: ${await lenientResponse.text()}`);
      return null;
    }
    
    const lenientData = await lenientResponse.json();
    
    if (lenientData.tracks?.items && lenientData.tracks.items.length > 0) {
      // Try to find a track with a matching artist
      const matchingTrack = lenientData.tracks.items.find((track: any) => {
        const trackArtists = track.artists.map((a: any) => a.name.toLowerCase()).join(' ');
        return trackArtists.includes(artist.toLowerCase());
      });
      
      if (matchingTrack) {
        return {
          id: matchingTrack.id,
          uri: matchingTrack.uri
        };
      }
      
      // If no artist match, just use the first result
      const track = lenientData.tracks.items[0];
      return {
        id: track.id,
        uri: track.uri
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Spotify:', error);
    return null;
  }
}

/**
 * Syncs playlist to Spotify
 * @param playlist - The playlist to sync
 * @param accessToken - Spotify access token
 * @param playlistDocument - Original Mongoose document for saving changes
 * @returns Sync result
 */
async function syncToSpotify(playlist: any, accessToken: string | undefined, playlistDocument?: any, session?: any) {
  try {
    if (!accessToken) {
      return {
        status: 'failed',
        message: 'No Spotify access token available',
        success: false
      };
    }

    // Check if playlist has Spotify platform data
    const spotifyData = playlist.platformData?.find(
      (data: any) => data.platform === 'spotify'
    );

    if (!spotifyData) {
      return {
        status: 'failed',
        message: 'Playlist is not connected to Spotify',
        success: false
      };
    }

    // Get Spotify playlist ID
    let spotifyPlaylistId = spotifyData.id || '';
    let needToCreatePlaylist = false;
    
    console.log(`Syncing to Spotify playlist ID: ${spotifyPlaylistId}`);
    
    // Check if the playlist ID exists and is valid
    if (spotifyPlaylistId) {
      // Verify the playlist exists on Spotify
      try {
        const { response: playlistCheckResponse, refreshedToken } = await fetchSpotifyWithTokenHandling(
          `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}`,
          accessToken,
          session?.user?.spotifyRefreshToken,
          {}
        );
        
        // If token was refreshed, update it
        if (refreshedToken) {
          accessToken = refreshedToken;
        }
        
        if (!playlistCheckResponse.ok) {
          // Detailed error handling for unauthorized/forbidden responses
          if (playlistCheckResponse.status === 401 || playlistCheckResponse.status === 403) {
            const errorText = await playlistCheckResponse.text();
            console.error(`Spotify authorization error (${playlistCheckResponse.status}) even after refresh: ${errorText}`);
            
            // Return specific error for token issues
            return {
              status: 'failed',
              message: `Spotify authentication error: ${playlistCheckResponse.status}. Please reconnect your Spotify account.`,
              success: false,
              spotifyAuthError: true
            };
          }
          
          console.log(`Spotify playlist with ID ${spotifyPlaylistId} not found or inaccessible (${playlistCheckResponse.status}), will create a new one`);
          needToCreatePlaylist = true;
        } else {
          const spotifyPlaylist = await playlistCheckResponse.json();
          console.log(`Found existing Spotify playlist: "${spotifyPlaylist.name}" with ${spotifyPlaylist.tracks?.total || 0} tracks`);
          
          // Double-check by fetching the user's playlists directly
          try {
            console.log("Attempting to fetch the user's playlists directly to verify track count...");
            
            const { response: userPlaylistsResponse, refreshedToken: newToken } = await fetchSpotifyWithTokenHandling(
              `https://api.spotify.com/v1/me/playlists?limit=50`,
              accessToken,
              session?.user?.spotifyRefreshToken,
              {
                headers: {
                  'Cache-Control': 'no-cache, no-store'
                }
              }
            );
            
            // If token was refreshed, update it
            if (newToken) {
              accessToken = newToken;
            }
            
            if (userPlaylistsResponse.ok) {
              const userPlaylists = await userPlaylistsResponse.json();
              const matchingPlaylist = userPlaylists.items.find((p: any) => p.id === spotifyPlaylistId);
              
              if (matchingPlaylist) {
                console.log(`Direct playlist check shows: "${matchingPlaylist.name}" with ${matchingPlaylist.tracks?.total || 0} tracks`);
                
                // If there's a discrepancy, use the higher track count
                if (matchingPlaylist.tracks?.total > spotifyPlaylist.tracks?.total) {
                  console.log(`⚠️ DISCREPANCY DETECTED: API reports ${spotifyPlaylist.tracks?.total} tracks but user's playlist has ${matchingPlaylist.tracks.total} tracks`);
                  spotifyPlaylist.tracks.total = matchingPlaylist.tracks.total;
                }
              }
            }
          } catch (error) {
            console.log("Error checking user playlists directly:", error);
            // Continue with existing playlist data
          }
          
          // Update Spotify playlist ID in our database if needed
          if (!playlist.spotifyId && spotifyPlaylistId) {
            console.log(`Updating playlist with Spotify ID: ${spotifyPlaylistId}`);
            
            // Update in MongoDB
            if (playlistDocument) {
              await Playlist.findByIdAndUpdate(
                playlistDocument._id,
                { $set: { spotifyId: spotifyPlaylistId } }
              );
            }
            
            // Update local object
            playlist.spotifyId = spotifyPlaylistId;
          }
        }
      } catch (error) {
        console.error('Error checking Spotify playlist:', error);
        needToCreatePlaylist = true;
      }
    } else {
      needToCreatePlaylist = true;
    }

    // Get Spotify user ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      return {
        status: 'failed',
        message: 'Failed to get Spotify user profile'
      };
    }

    const userData = await userResponse.json();
    const userId = userData.id;
    console.log(`Syncing as Spotify user: ${userId}`);

    // STEP 2: Push changes from Musync to Spotify
    
    // Create a new playlist if needed
    if (needToCreatePlaylist) {
      console.log('Creating new Spotify playlist');
      const createResponse = await fetch(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: playlist.title || playlist.name || 'My Playlist',
            description: playlist.description || '',
            public: false
          })
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create Spotify playlist:', errorText);
        return {
          status: 'failed',
          message: `Failed to create Spotify playlist: ${errorText}`
        };
      }

      const newPlaylist = await createResponse.json();
      spotifyPlaylistId = newPlaylist.id;
      console.log(`Created new Spotify playlist with ID: ${spotifyPlaylistId}`);

      // Update the playlist in the database with the new Spotify ID
      await Playlist.findByIdAndUpdate(
        playlist._id,
        {
          $set: {
            'platformData.$[elem].id': spotifyPlaylistId,
            'platformData.$[elem].lastSyncedAt': new Date()
          }
        },
        {
          arrayFilters: [{ 'elem.platform': 'spotify' }]
        }
      );
    } else {
      // Update existing playlist details
      console.log(`Updating Spotify playlist details for ID: ${spotifyPlaylistId}`);
      const updateResponse = await fetch(`https://api.spotify.com/v1/playlists/${spotifyPlaylistId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: playlist.title || playlist.name || 'My Playlist',
          description: playlist.description || '',
          public: false
        })
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Failed to update Spotify playlist details:', errorText);
      } else {
        console.log('Successfully updated Spotify playlist details');
      }
    }

    // Get current tracks in Spotify playlist
    console.log(`Fetching current tracks from Spotify playlist: ${spotifyPlaylistId}`);
    const currentTracksResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!currentTracksResponse.ok) {
      const errorText = await currentTracksResponse.text();
      console.error('Failed to get current tracks from Spotify:', errorText);
      return {
        status: 'failed',
        message: `Failed to get current tracks from Spotify: ${errorText}`
      };
    }

    const currentTracks = await currentTracksResponse.json();
    console.log(`Found ${currentTracks.items?.length || 0} tracks in Spotify playlist`);
    
    // If not empty, import any new tracks from Spotify that don't exist locally
    if (currentTracks.items?.length > 0) {
      const { importedCount } = await syncRemoteTracksToLocal(
        playlist,
        currentTracks.items,
        'spotify',
        'spotifyId',
        (item: any) => {
          if (!item.track) return null;
          
          return {
            title: item.track.name || '',
            artist: item.track.artists?.map((a: any) => a.name).join(', ') || '',
            album: item.track.album?.name || '',
            duration: item.track.duration_ms || 0,
            spotifyId: item.track.id,
            spotifyUri: item.track.uri,
            addedAt: new Date(item.added_at || Date.now()),
            updatedAt: new Date()
          };
        },
        playlistDocument
      );
      
      if (importedCount > 0) {
        console.log(`Added ${importedCount} new tracks from Spotify to local playlist`);
      }
    }

    // Find tracks to add and remove
    const spotifyTrackIds = new Set(currentTracks.items?.map((item: any) => item.track?.id).filter(Boolean));
    const localTrackIds = new Set(playlist.tracks.map((track: any) => track.spotifyId).filter(Boolean));
    
    // Tracks to remove are in Spotify but not in our local playlist
    let tracksToRemove = [];
    
    for (const item of currentTracks.items || []) {
      if (item.track?.id && !localTrackIds.has(item.track.id)) {
        // Double-check this track isn't a duplicate with different ID formatting
        let isDuplicate = false;
        for (const localTrack of playlist.tracks || []) {
          // Compare track name and artist to avoid removing same tracks with different IDs
          if (localTrack.title && item.track.name && 
              localTrack.title.toLowerCase() === item.track.name.toLowerCase() &&
              localTrack.artist && item.track.artists && item.track.artists[0]?.name &&
              localTrack.artist.toLowerCase().includes(item.track.artists[0].name.toLowerCase())) {
            isDuplicate = true;
            console.log(`Found matching track by name/artist: "${item.track.name}" - keeping on Spotify`);
            break;
          }
        }
        
        if (!isDuplicate) {
          tracksToRemove.push(item);
          console.log(`Will remove track from Spotify: ${item.track.name} by ${item.track.artists.map((a: any) => a.name).join(', ')}`);
        }
      }
    }
    
    // Remove tracks that are not in our local playlist
    if (tracksToRemove.length > 0) {
      // If local playlist is empty, import tracks from Spotify instead of aborting
      if (!playlist.tracks || playlist.tracks.length === 0) {
        console.log('Local playlist is empty. Importing tracks from Spotify...');
        
        // Create a tracks array if it doesn't exist
        if (!playlist.tracks) {
          playlist.tracks = [];
        }
        
        // Import tracks from Spotify to local playlist
        let importedCount = 0;
        
        for (const item of currentTracks.items || []) {
          if (item.track) {
            // Add the track to our local playlist
            playlist.tracks.push({
              title: item.track.name || '',
              artist: item.track.artists?.map((a: any) => a.name).join(', ') || '',
              album: item.track.album?.name || '',
              duration: item.track.duration_ms || 0,
              spotifyId: item.track.id,
              spotifyUri: item.track.uri,
              addedAt: new Date(item.added_at || Date.now()),
              updatedAt: new Date()
            });
            
            importedCount++;
          }
        }
        
        // Save the updated playlist with imported tracks
        if (playlistDocument) {
          // Update the Mongoose document if available
          await Playlist.findByIdAndUpdate(
            playlistDocument._id,
            { $set: { tracks: playlist.tracks } }
          );
        } else {
          await playlist.save();
        }
        
        console.log(`Imported ${importedCount} tracks from Spotify to local playlist`);
        
        // No need to continue with sync since we just imported everything
        return {
          status: 'success',
          message: `Imported ${importedCount} tracks from Spotify to local playlist`,
          spotifyPlaylistId
        };
      }
      
      // SAFETY CHECK: If no tracks have Spotify IDs, don't remove any tracks
      const hasSpotifyIds = playlist.tracks.some((track: any) => track.spotifyId || track.spotifyUri);
      if (!hasSpotifyIds) {
        console.log('No tracks have Spotify IDs. Will try to match tracks by title and artist...');
        
        // Try to find matches for local tracks without Spotify IDs
        let matchedCount = 0;
        
        for (const track of playlist.tracks) {
          if (!track.spotifyId && !track.spotifyUri) {
            // Search for a match in the Spotify playlist
            const matchingItem = currentTracks.items?.find((item: any) => {
              if (!item.track) return false;
              
              const titleMatch = track.title && item.track.name &&
                                track.title.toLowerCase() === item.track.name.toLowerCase();
                                
              const artistMatch = track.artist && item.track.artists &&
                                item.track.artists.some((a: any) => 
                                  track.artist.toLowerCase().includes(a.name.toLowerCase()));
                                
              return titleMatch && artistMatch;
            });
            
            if (matchingItem && matchingItem.track) {
              // Update track with Spotify IDs
              track.spotifyId = matchingItem.track.id;
              track.spotifyUri = matchingItem.track.uri;
              matchedCount++;
            }
          }
        }
        
        if (matchedCount > 0) {
          // Save the updated tracks with Spotify IDs
          if (playlistDocument) {
            await Playlist.findByIdAndUpdate(
              playlistDocument._id,
              { $set: { tracks: playlist.tracks } }
            );
          } else {
            await playlist.save();
          }
          
          console.log(`Matched ${matchedCount} local tracks with Spotify tracks`);
          
          // Recalculate tracksToRemove with the new Spotify IDs
          const updatedLocalSpotifyIds = new Set(
            playlist.tracks
              .map((t: any) => t.spotifyId || (t.spotifyUri ? t.spotifyUri.split(':')[2] : null))
              .filter(Boolean)
          );
          
          tracksToRemove = currentTracks.items?.filter((item: any) => 
            item.track?.id && !updatedLocalSpotifyIds.has(item.track.id)
          ) || [];
        }
        
        // Still no matches? Import Spotify tracks to local
        if (matchedCount === 0 && (currentTracks.items?.length || 0) > 0) {
          console.log('No matches found. Importing Spotify tracks to local playlist...');
          
          let importedCount = 0;
          
          for (const item of currentTracks.items || []) {
            if (item.track) {
              // Add the track to our local playlist
              playlist.tracks.push({
                title: item.track.name || '',
                artist: item.track.artists?.map((a: any) => a.name).join(', ') || '',
                album: item.track.album?.name || '',
                duration: item.track.duration_ms || 0,
                spotifyId: item.track.id,
                spotifyUri: item.track.uri,
                addedAt: new Date(item.added_at || Date.now()),
                updatedAt: new Date()
              });
              
              importedCount++;
            }
          }
          
          // Save the updated playlist with imported tracks
          if (playlistDocument) {
            await Playlist.findByIdAndUpdate(
              playlistDocument._id,
              { $set: { tracks: playlist.tracks } }
            );
          } else {
            await playlist.save();
          }
          
          console.log(`Imported ${importedCount} tracks from Spotify to local playlist`);
          
          // No need to continue with remove operations
          return {
            status: 'success',
            message: `Imported ${importedCount} tracks from Spotify to local playlist`,
            spotifyPlaylistId
          };
        }
      }
      
      // SAFETY CHECK: Don't remove more than 90% of the playlist at once
      if (tracksToRemove.length > 0 && currentTracks.items?.length > 0 && 
          (tracksToRemove.length / currentTracks.items.length) > 0.9) {
        console.log('WARNING: Would remove more than 90% of tracks from Spotify playlist. Operation aborted.');
        return {
          status: 'warning',
          message: 'Operation would remove more than 90% of tracks from Spotify playlist. Sync was aborted to prevent data loss.',
          spotifyPlaylistId
        };
      }
      
      console.log(`Removing ${tracksToRemove.length} tracks from Spotify that were deleted locally`);

      // Remove tracks from Spotify
      for (const item of tracksToRemove) {
        try {
          console.log(`Removing track ${item.track.name} from Spotify playlist`);
          const removeResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks?ids=${item.track.id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
          
          if (!removeResponse.ok) {
            console.error(`Failed to remove track ${item.track.name}: ${removeResponse.statusText}`);
          }
        } catch (error) {
          console.error(`Error removing track ${item.track.name}:`, error);
        }
      }
    } else {
      console.log('No tracks to remove from Spotify');
    }

    // Process local tracks
    console.log(`Processing ${playlist.tracks.length} tracks from Musync playlist`);
    
    const tracksToAdd: string[] = [];
    const missingTrackIds: string[] = [];
    const spotifyTrackLookup: Map<string, { id: string, uri: string }> = new Map();
    const tracksWithoutSpotifyMatch: { title: string, artist: string }[] = [];
    
    // First, collect all uris and look for missing IDs
    for (const track of playlist.tracks) {
      // Skip tracks without title or artist
      if (!track.title || !track.artist) {
        console.log(`Skipping track with missing title or artist: ${track.title || ''} - ${track.artist || ''}`);
        continue;
      }
      
      // If the track already has a Spotify ID or URI, use it
      if (track.spotifyUri) {
        tracksToAdd.push(track.spotifyUri);
        continue;
      }
      
      if (track.spotifyId) {
        const uri = `spotify:track:${track.spotifyId}`;
        tracksToAdd.push(uri);
        continue;
      }
      
      // If we don't have a Spotify ID, try to search for the track
      missingTrackIds.push(track._id?.toString() || track.id?.toString() || '');
      spotifyTrackLookup.set(track._id?.toString() || track.id?.toString() || '', {
        id: '',
        uri: ''
      });
      
      console.log(`Track missing Spotify ID: ${track.title} - ${track.artist}. Will search Spotify.`);
      tracksWithoutSpotifyMatch.push({
        title: track.title,
        artist: track.artist
      });
    }
    
    // Batch search for tracks that don't have Spotify IDs
    if (tracksWithoutSpotifyMatch.length > 0) {
      console.log(`Searching Spotify for ${tracksWithoutSpotifyMatch.length} tracks...`);
      let foundCount = 0;
      
      for (let i = 0; i < tracksWithoutSpotifyMatch.length; i++) {
        const { title, artist } = tracksWithoutSpotifyMatch[i];
        const trackId = missingTrackIds[i];
        
        // Wait a small amount to avoid rate limiting
        if (i > 0 && i % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const spotifyTrack = await searchSpotify(accessToken, title, artist);
        
        if (spotifyTrack) {
          console.log(`Found Spotify match for "${title} - ${artist}": ${spotifyTrack.id}`);
          tracksToAdd.push(spotifyTrack.uri);
          spotifyTrackLookup.set(trackId, spotifyTrack);
          foundCount++;
          
          // Update the track in the database with the new Spotify ID
          if (playlistDocument) {
            try {
              // Make sure we have a valid ObjectId
              let trackObjectId;
              try {
                trackObjectId = new ObjectId(trackId);
              } catch (error) {
                console.error(`Invalid ObjectId format for track: ${trackId}`);
                continue;
              }
              
              await Playlist.updateOne(
                { _id: playlistDocument._id, "tracks._id": trackObjectId },
                { 
                  $set: { 
                    "tracks.$.spotifyId": spotifyTrack.id,
                    "tracks.$.spotifyUri": spotifyTrack.uri
                  } 
                }
              );
              console.log(`Updated track in database with Spotify ID: ${spotifyTrack.id}`);
            } catch (updateError) {
              console.error(`Error updating track ${trackId} with Spotify ID:`, updateError);
            }
          }
        } else {
          console.log(`No Spotify match found for "${title} - ${artist}"`);
        }
      }
      
      console.log(`Found Spotify matches for ${foundCount} out of ${tracksWithoutSpotifyMatch.length} tracks`);
    }
    
    if (tracksToAdd.length > 0) {
      // Add tracks in batches of 100 (Spotify API limit)
      console.log(`Adding ${tracksToAdd.length} tracks to Spotify playlist`);
      
      for (let i = 0; i < tracksToAdd.length; i += 100) {
        const batch = tracksToAdd.slice(i, i + 100);
        
        try {
          const addResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/tracks`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                uris: batch
              })
            }
          );
          
          if (!addResponse.ok) {
            console.error(`Failed to add tracks to Spotify playlist: ${await addResponse.text()}`);
          } else {
            console.log(`Added batch of ${batch.length} tracks to Spotify playlist`);
          }
        } catch (error) {
          console.error('Error adding tracks to Spotify playlist:', error);
        }
      }
    } else {
      console.log('No new tracks to add to Spotify');
    }

    // Verify the tracks were added
    const verifyResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log(`Verification: Spotify playlist now has ${verifyData.tracks?.total || 0} tracks`);
      
      // Update the last synced time in the database
      await Playlist.findByIdAndUpdate(
        playlist._id,
        {
          $set: {
            'platformData.$[elem].lastSyncedAt': new Date(),
            'platformData.$[elem].syncStatus': 'synced'
          }
        },
        {
          arrayFilters: [{ 'elem.platform': 'spotify' }]
        }
      );
    }

    // Success return value with playlist URL
    return {
      status: 'success',
      message: `Synchronized with Spotify successfully`,
      spotifyPlaylistId,
      success: true,
      spotifyUrl: `https://open.spotify.com/playlist/${spotifyPlaylistId}`
    };
  } catch (error) {
    console.error('Error syncing with Spotify:', error);
    
    // Attempt to update playlist status to indicate error
    try {
      if (playlistDocument) {
        const updatedPlatformData = playlistDocument.platformData.map((data: any) => {
          if (data.platform === 'spotify') {
            return {
              ...data,
              syncStatus: 'failed',
              syncError: error instanceof Error ? error.message : 'Unknown error',
              lastSyncedAt: new Date()
            };
          }
          return data;
        });
        
        await Playlist.findByIdAndUpdate(
          playlistDocument._id,
          { $set: { platformData: updatedPlatformData } }
        );
      }
    } catch (updateError) {
      console.error('Could not update playlist sync status:', updateError);
    }
    
    return {
      status: 'failed',
      message: `Failed to sync with Spotify: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    };
  }
}

/**
 * Syncs tracks from a remote platform to the local playlist
 * 
 * @param playlist - The local playlist object
 * @param remoteTracks - Array of tracks from the remote platform
 * @param platform - The platform name ('spotify' or 'youtube')
 * @param idField - The field name to store the platform's track ID
 * @param transformTrack - Function to transform remote track to local format
 * @param playlistDocument - Original Mongoose document for saving changes (optional)
 * @returns Object with the count of tracks imported
 */
async function syncRemoteTracksToLocal(
  playlist: any, 
  remoteTracks: any[], 
  platform: 'spotify' | 'youtube',
  idField: string,
  transformTrack: (remoteTrack: any) => any,
  playlistDocument?: any
) {
  if (!remoteTracks || remoteTracks.length === 0) {
    return { importedCount: 0 };
  }
  
  // Create tracks array if it doesn't exist
  if (!playlist.tracks) {
    playlist.tracks = [];
  }
  
  // Get set of existing IDs
  const existingIds = new Set(
    playlist.tracks
      .map((track: any) => track[idField])
      .filter(Boolean)
  );
  
  // Find tracks that don't exist locally
  const newRemoteTracks = remoteTracks.filter((remoteTrack: any) => {
    const id = platform === 'spotify' 
      ? (remoteTrack.track?.id || null)
      : (remoteTrack.contentDetails?.videoId || remoteTrack.id?.videoId || remoteTrack.id);
    
    return id && !existingIds.has(id);
  });
  
  // Import new tracks to local playlist
  let importedCount = 0;
  
  for (const remoteTrack of newRemoteTracks) {
    const localTrack = transformTrack(remoteTrack);
    if (localTrack) {
      playlist.tracks.push(localTrack);
      importedCount++;
    }
  }
  
  // Save the updated playlist with imported tracks if any were added
  if (importedCount > 0) {
    if (playlistDocument) {
      // Update the Mongoose document if available
      await Playlist.findByIdAndUpdate(
        playlistDocument._id,
        { $set: { tracks: playlist.tracks } }
      );
    } else {
      await playlist.save();
    }
    console.log(`Imported ${importedCount} new tracks from ${platform} to local playlist`);
  }
  
  return { importedCount };
}

/**
 * Helper function to match a YouTube video title to a track
 * 
 * @param videoTitle - The title of the YouTube video
 * @param track - The track to match against
 * @returns Whether the video matches the track
 */
function videoMatchesTrack(videoTitle: string, track: any): boolean {
  // Normalize strings for comparison
  const normalizeStr = (str: string | undefined | null) => {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  };
  
  const normalizedVideoTitle = normalizeStr(videoTitle);
  const normalizedTrackTitle = normalizeStr(track.title || '');
  const normalizedArtist = normalizeStr(track.artist || '');
  
  // Check if video title contains both track title and artist
  const containsTrackTitle = normalizedTrackTitle !== '' && 
    normalizedVideoTitle.includes(normalizedTrackTitle);
  
  const containsArtist = normalizedArtist !== '' && 
    normalizedVideoTitle.includes(normalizedArtist);
  
  return containsTrackTitle && containsArtist;
}

/**
 * Helper function to import missing videos from YouTube into a Musync playlist
 * 
 * @param playlist - The Musync playlist to update
 * @param youtubeVideos - The YouTube videos to import
 * @param playlistDocument - Optional Mongoose document for saving changes
 * @returns The number of videos imported
 */
async function importMissingVideosFromYouTube(playlist: any, youtubeVideos: any[], playlistDocument?: any): Promise<number> {
  // Create a set of existing YouTube IDs in the playlist
  const existingYoutubeIds = new Set<string>(
    playlist.tracks
      .map((track: any) => track.youtubeId)
      .filter(Boolean)
  );
  
  // Find videos that aren't already in the playlist
  const missingVideos = youtubeVideos.filter(video => {
    const videoId = video.contentDetails?.videoId || video.id?.videoId || video.snippet?.resourceId?.videoId;
    return videoId && !existingYoutubeIds.has(videoId);
  });
  
  if (missingVideos.length === 0) {
    console.log('No missing videos to import');
    return 0;
  }
  
  console.log(`Importing ${missingVideos.length} missing videos from YouTube to Musync playlist`);
  
  // Add the missing videos to the playlist
  for (const video of missingVideos) {
    const videoId = video.contentDetails?.videoId || video.id?.videoId || video.snippet?.resourceId?.videoId;
    
    if (!videoId) continue;
    
    // Create a new track for this video
    const newTrack = {
      title: video.snippet?.title || '',
      artist: video.snippet?.videoOwnerChannelTitle || '',
      duration: 0, // YouTube API doesn't directly provide duration in this response
      youtubeId: videoId,
      addedAt: new Date(video.snippet?.publishedAt || Date.now()),
      updatedAt: new Date(),
      platformData: [
        {
          platform: 'youtube',
          id: videoId,
          status: 'synced'
        }
      ]
    };
    
    // Add the track to the playlist
    playlist.tracks.push(newTrack);
  }
  
  // Save the updated playlist
  if (playlistDocument) {
    await Playlist.findByIdAndUpdate(
      playlistDocument._id,
      { $set: { tracks: playlist.tracks } }
    );
  } else {
    await playlist.save();
  }
  
  return missingVideos.length;
}

/**
 * Syncs playlist to YouTube
 * @param playlist - The playlist to sync
 * @param session - User session with access tokens
 * @param playlistDocument - Original Mongoose document for saving changes
 * @returns Sync result
 */
async function syncToYouTube(playlist: any, session: any, playlistDocument?: any) {
  try {
    // Check authentication options
    const accessToken = session?.user?.googleAccessToken || null;
    let usingApiKeyFallback = false;
    
    // Check for Google authentication issues
    if (!accessToken && process.env.YOUTUBE_API_KEY) {
      console.log('No Google access token available, will attempt to use API key for limited functionality');
      usingApiKeyFallback = true;
    } else if (session?.user?.googleError === 'RefreshAccessTokenError' && process.env.YOUTUBE_API_KEY) {
      console.log('Google token refresh failed previously, will attempt to use API key for limited functionality');
      usingApiKeyFallback = true;
    }
    
    // If no auth method available, return error
    if (!accessToken && !process.env.YOUTUBE_API_KEY) {
      return {
        status: 'failed',
        message: 'No Google access token or API key available',
        success: false
      };
    }
    
    // Check if playlist has YouTube platform data
    const youtubeData = playlist.platformData?.find(
      (data: any) => data.platform === 'youtube'
    );
    
    if (!youtubeData) {
      return {
        status: 'failed',
        message: 'Playlist is not connected to YouTube',
        success: false
      };
    }
    
    // Get YouTube playlist ID
    let youtubePlaylistId = youtubeData.id || '';
    let needToCreatePlaylist = false;
    
    console.log(`Syncing to YouTube playlist ID: ${youtubePlaylistId}`);

    // Provide a warning if we're using API key fallback and want to create/update playlist
    if (usingApiKeyFallback && (!youtubePlaylistId || youtubePlaylistId.length === 0)) {
      console.warn('Using API key fallback but trying to create a new playlist - this will fail');
      return {
        status: 'failed',
        message: 'Cannot create a new YouTube playlist without proper authentication. Please reconnect your Google account.',
        success: false,
        needsReconnect: true
      };
    }
    
    // Check if YouTube playlist ID exists and is valid
    if (!youtubePlaylistId) {
      console.log('No YouTube playlist ID found, will create new playlist');
      needToCreatePlaylist = true;
    } else {
      // Try to fetch the playlist from YouTube
      try {
        // Optimize quota by only requesting the minimal fields we need
        const response = await fetchYouTubeWithQuotaHandling(
          `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${youtubePlaylistId}&fields=items(id,snippet/title)`,
          accessToken,
          {},
          3,  // 3 retries
          true // Use cache
        );

        if (!response.ok) {
          // Check for quota error response from our helper
          try {
            const errorData = await response.json();
            if (errorData?.error?.domain === 'youtube.quota') {
              return {
                status: 'failed',
                message: 'YouTube API quota exceeded. Please try again later.',
                quotaExceeded: true,
                success: false
              };
            }
          } catch (e) {
            // JSON parsing failed, continue with normal error handling
          }
          
          const errorText = await response.text();
          console.error('Failed to fetch YouTube playlist:', errorText);
          
          if (response.status === 404) {
            console.log('YouTube playlist not found, will create a new one');
            needToCreatePlaylist = true;
          } else {
            return {
              status: 'failed',
              message: `Failed to fetch YouTube playlist: ${errorText}`
            };
          }
        } else {
          const data = await response.json();
          if (!data.items || data.items.length === 0) {
            console.log('YouTube playlist not found, will create a new one');
            needToCreatePlaylist = true;
          }
        }
      } catch (error) {
        console.error('Error fetching YouTube playlist:', error);
        return {
          status: 'failed',
          message: `Error fetching YouTube playlist: ${(error as Error).message}`
        };
      }
    }

    // Get YouTube user ID
    const userResponse = await fetchYouTubeWithQuotaHandling(
      // Optimize quota by only requesting the minimal fields we need
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&fields=items(id,snippet/title)',
      accessToken,
      {},
      3,  // 3 retries
      true // Use cache
    );

    if (!userResponse.ok) {
      // Check for quota error
      try {
        const errorData = await userResponse.json();
        if (errorData?.error?.domain === 'youtube.quota') {
          return {
            status: 'failed',
            message: 'YouTube API quota exceeded. Please try again later.',
            quotaExceeded: true,
            success: false
          };
        }
      } catch (e) {
        // JSON parsing failed, continue with normal error handling
      }
      
      const errorText = await userResponse.text();
      console.error('Failed to get YouTube user channels:', errorText);
      return {
        status: 'failed',
        message: `Failed to get YouTube user channels: ${errorText}`
      };
    }

    const userData = await userResponse.json();
    const channelId = userData.items?.[0]?.id;

    if (!channelId) {
      return {
        status: 'failed',
        message: 'Could not find YouTube channel for current user'
      };
    }

    // STEP 1: Create or update the YouTube playlist
    
    if (needToCreatePlaylist) {
      // Check if we're using API key fallback - can't create playlists with just API key
      if (usingApiKeyFallback) {
        return {
          status: 'failed',
          message: 'Cannot create a new YouTube playlist with API key. Please reconnect your Google account.',
          success: false,
          needsReconnect: true
        };
      }
      
      console.log('Creating new YouTube playlist');
      const createResponse = await fetch(
        'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            snippet: {
              title: playlist.title || playlist.name || 'My Playlist',
              description: playlist.description || '',
              channelId: channelId
            },
            status: {
              privacyStatus: playlist.isPublic ? 'public' : 'private'
            }
          })
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create YouTube playlist:', errorText);
        
        // Check if it's an authentication error
        if (createResponse.status === 401 || createResponse.status === 403) {
          return {
            status: 'failed',
            message: 'Authentication failed. Please reconnect your Google account.',
            success: false,
            needsReconnect: true
          };
        }
        
        return {
          status: 'failed',
          message: `Failed to create YouTube playlist: ${errorText}`
        };
      }

      const newPlaylist = await createResponse.json();
      youtubePlaylistId = newPlaylist.id;
      console.log(`Created new YouTube playlist with ID: ${youtubePlaylistId}`);

      // Update the playlist in the database with the new YouTube ID
      const platformDataToUpdate = {
        platform: 'youtube',
        id: youtubePlaylistId,
        platformId: youtubePlaylistId,
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      };

      // Check if platformData exists, if not, create it
      if (!playlist.platformData) {
        playlist.platformData = [platformDataToUpdate];
      } else {
        // Check if youtube platform data exists
        const ytIndex = playlist.platformData.findIndex((data: any) => data.platform === 'youtube');
        if (ytIndex >= 0) {
          playlist.platformData[ytIndex] = {
            ...playlist.platformData[ytIndex],
            ...platformDataToUpdate
          };
        } else {
          playlist.platformData.push(platformDataToUpdate);
        }
      }
      
      await playlist.save();
    } else {
      // Update existing playlist details
      console.log(`Updating YouTube playlist details for ID: ${youtubePlaylistId}`);
      const updateResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,status`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: youtubePlaylistId,
            snippet: {
              title: playlist.title || playlist.name || 'My Playlist',
              description: playlist.description || '',
              channelId: channelId
            },
            status: {
              privacyStatus: playlist.isPublic ? 'public' : 'private'
            }
          })
        }
      );
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Failed to update YouTube playlist details:', errorText);
      } else {
        console.log('Successfully updated YouTube playlist details');
      }
    }

    // STEP 2: Get current videos in YouTube playlist
    console.log(`Fetching current videos from YouTube playlist: ${youtubePlaylistId}`);
    
    const currentVideos: any[] = [];
    let nextPageToken: string | null = null;
    
    // Use a smaller batch size to help with quotas
    const MAX_RESULTS = 25; // Reduce from 50 to 25
    // Limit total items to fetch (adjust based on your app's needs)
    const MAX_TOTAL_ITEMS = 200;
    let totalFetched = 0;
    
    do {
      // Optimize fields to only get what we need
      const fields = 'items(id,snippet(title,videoOwnerChannelTitle,publishedAt,resourceId),contentDetails(videoId)),nextPageToken,pageInfo';
      
      const pageUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${youtubePlaylistId}&maxResults=${MAX_RESULTS}&fields=${encodeURIComponent(fields)}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
      
      const videosResponse = await fetchYouTubeWithQuotaHandling(
        pageUrl,
        accessToken,
        {},
        3, // 3 retries
        true // Use cache
      );

      if (!videosResponse.ok) {
        // Check for quota error
        try {
          const errorData = await videosResponse.json();
          if (errorData?.error?.domain === 'youtube.quota') {
            return {
              status: 'failed',
              message: 'YouTube API quota exceeded. Please try again later.',
              quotaExceeded: true,
              success: false
            };
          }
        } catch (e) {
          // JSON parsing failed, continue with normal error handling
        }
        
        const errorText = await videosResponse.text();
        console.error('Failed to get current videos from YouTube:', errorText);
        return {
          status: 'failed',
          message: `Failed to get current videos from YouTube: ${errorText}`
        };
      }

      const videosData = await videosResponse.json();
      if (videosData.items && videosData.items.length > 0) {
        currentVideos.push(...videosData.items);
        totalFetched += videosData.items.length;
        console.log(`Fetched ${totalFetched} YouTube videos so far`);
      }
      
      nextPageToken = videosData.nextPageToken || null;
      
      // Stop if we've reached our limit to prevent excessive quota usage
      if (totalFetched >= MAX_TOTAL_ITEMS) {
        console.log(`Reached maximum fetch limit of ${MAX_TOTAL_ITEMS} items`);
        break;
      }
      
      // Add a small delay between requests to be kind to the API
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } while (nextPageToken);
    
    console.log(`Found ${currentVideos.length} videos in YouTube playlist`);
    
    // Special case: If YouTube playlist exists but is empty, search for and add tracks directly
    if (currentVideos.length === 0 && playlist.tracks && playlist.tracks.length > 0) {
      console.log('YouTube playlist is empty. Searching and adding tracks...');
      
      let addedCount = 0;
      let failedCount = 0;
      
      for (const track of playlist.tracks) {
        if (!track.title || !track.artist) {
          console.log(`Skipping track with missing title or artist: ${track.title || ''} - ${track.artist || ''}`);
          continue;
        }
        
        // Search for the track on YouTube
        const searchQuery = encodeURIComponent(`${track.artist} - ${track.title}`);
        console.log(`Searching for: ${track.artist} - ${track.title}`);
        
        try {
          // Define minimal fields needed to reduce quota cost
          const fields = 'items(id/videoId,snippet/title),pageInfo';
          const searchResponse = await fetchYouTubeWithQuotaHandling(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1&fields=${encodeURIComponent(fields)}`,
            accessToken,
            {},
            3, // 3 retries
            true // Use cache for search results (useful for failed syncs)
          );
          
          if (!searchResponse.ok) {
            // Check for quota error
            try {
              const errorData = await searchResponse.json();
              if (errorData?.error?.domain === 'youtube.quota') {
                console.warn('YouTube quota exceeded during search. Stopping syncing process.');
                return {
                  status: 'partial',
                  message: `Added ${addedCount} videos to YouTube playlist. YouTube API quota exceeded.`,
                  success: addedCount > 0,
                  quotaExceeded: true,
                  youtubeUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`
                };
              }
            } catch (e) {
              // JSON parsing failed, continue with normal error handling
            }
            
            console.error('Failed to search YouTube:', await searchResponse.text());
            failedCount++;
            continue;
          }
          
          const searchData = await searchResponse.json();
          if (searchData.items && searchData.items.length > 0) {
            const videoId = searchData.items[0].id?.videoId;
            
            if (videoId) {
              console.log(`Found YouTube match: ${videoId} for "${track.title}"`);
              
              // Update the track with the found YouTube ID
              track.youtubeId = videoId;
              
              // Save the updated track in the database
              if (playlistDocument) {
                try {
                  await Playlist.updateOne(
                    { _id: playlistDocument._id, "tracks._id": track._id },
                    { $set: { "tracks.$.youtubeId": videoId } }
                  );
                } catch (error) {
                  console.error(`Failed to update track with YouTube ID: ${error}`);
                }
              }
              
              // Add the track to the YouTube playlist
              try {
                const addResponse = await fetchYouTubeWithQuotaHandling(
                  'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
                  accessToken,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      snippet: {
                        playlistId: youtubePlaylistId,
                        resourceId: {
                          kind: 'youtube#video',
                          videoId: videoId
                        }
                      }
                    })
                  },
                  2, // Fewer retries for write operations
                  false // Don't use cache for POST requests
                );
                
                if (addResponse.ok) {
                  console.log(`Added track to YouTube playlist: ${track.title}`);
                  addedCount++;
                } else {
                  console.error(`Failed to add video to YouTube playlist:`, await addResponse.text());
                  failedCount++;
                }
              } catch (error) {
                console.error(`Error adding video to YouTube playlist: ${error}`);
                failedCount++;
              }
            } else {
              console.log(`No video ID found for track: ${track.title}`);
              failedCount++;
            }
          } else {
            console.log(`No YouTube results found for: ${track.artist} - ${track.title}`);
            failedCount++;
          }
        } catch (error) {
          console.error(`Error searching YouTube: ${error}`);
          failedCount++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Now that we've attempted to add all tracks, update the database with any YouTube IDs we found
      if (playlistDocument && addedCount > 0) {
        try {
          await Playlist.findByIdAndUpdate(
            playlistDocument._id,
            { $set: { tracks: playlist.tracks } }
          );
          console.log(`Updated playlist in database with ${addedCount} YouTube IDs`);
        } catch (error) {
          console.error(`Failed to update playlist with YouTube IDs: ${error}`);
        }
      }
      
      return {
        status: 'success',
        message: `Added ${addedCount} tracks to empty YouTube playlist (${failedCount} failed)`,
        success: true,
        youtubeUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`,
        youtubePlaylistId,
        added: addedCount
      };
    }
    
    // STEP 3: Find tracks to add and remove
    const youtubeVideoIds = new Set(currentVideos.map((item: any) => item.contentDetails?.videoId).filter(Boolean));
    
    // If local playlist is empty, import videos from YouTube
    if (!playlist.tracks || playlist.tracks.length === 0) {
      console.log('Local playlist is empty. Importing videos from YouTube...');
      
      // Create tracks array if it doesn't exist
      if (!playlist.tracks) {
        playlist.tracks = [];
      }
      
      // Import videos from YouTube
      let importedCount = 0;
      
      for (const video of currentVideos) {
        // Add the video to our local playlist
        playlist.tracks.push({
          title: video.snippet?.title || '',
          artist: video.snippet?.videoOwnerChannelTitle || '',
          duration: 0, // YouTube API doesn't directly provide duration in this response
          youtubeId: video.contentDetails?.videoId || video.id?.videoId || video.id,
          addedAt: new Date(video.snippet?.publishedAt || Date.now()),
          updatedAt: new Date()
        });
        
        importedCount++;
      }
      
      // Save the updated playlist with imported tracks
      if (playlistDocument) {
        await Playlist.findByIdAndUpdate(
          playlistDocument._id,
          { $set: { tracks: playlist.tracks } }
        );
      } else {
        await playlist.save();
      }
      
      console.log(`Imported ${importedCount} videos from YouTube to local playlist`);
      
      return {
        status: 'success',
        message: `Imported ${importedCount} videos from YouTube to local playlist`,
        youtubePlaylistId,
        success: true,
        youtubeUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`
      };
    }
    
    // Try to match local tracks without YouTube IDs to YouTube videos
    const tracksWithoutYoutubeId = playlist.tracks.filter((track: any) => !track.youtubeId);
    
    if (tracksWithoutYoutubeId.length > 0 && currentVideos.length > 0) {
      console.log(`Found ${tracksWithoutYoutubeId.length} tracks without YouTube IDs. Attempting to match...`);
      
      let matchedCount = 0;
      
      for (const track of tracksWithoutYoutubeId) {
        // Find a matching video by title and artist
        const matchingVideo = currentVideos.find((video: any) => 
          video.snippet?.title && videoMatchesTrack(video.snippet.title, track)
        );
        
        if (matchingVideo) {
          // Update track with YouTube ID
          track.youtubeId = matchingVideo.contentDetails?.videoId || 
                            matchingVideo.id?.videoId || 
                            matchingVideo.id;
          matchedCount++;
        }
      }
      
      if (matchedCount > 0) {
        console.log(`Matched ${matchedCount} local tracks with YouTube videos`);
        
        // Save the updated tracks with YouTube IDs
        if (playlistDocument) {
          await Playlist.findByIdAndUpdate(
            playlistDocument._id,
            { $set: { tracks: playlist.tracks } }
          );
        } else {
          await playlist.save();
        }
      }
    }
    
    // Calculate videos to remove with updated tracks
    const youtubeIds = new Set<string>(
      playlist.tracks
        .map((track: any) => track.youtubeId)
        .filter(Boolean)
    );
    
    const videosToRemove = currentVideos.filter(
      (video: any) => {
        const videoId = video.contentDetails?.videoId || video.id?.videoId || video.id;
        return videoId && !youtubeIds.has(videoId);
      }
    );
    
    // SAFETY CHECK: If we would remove all videos and local playlist has no tracks with YouTube IDs, abort
    if (videosToRemove.length === currentVideos.length && playlist.tracks.every((t: any) => !t.youtubeId)) {
      console.log('WARNING: Would remove all videos from YouTube playlist but no local tracks have YouTube IDs.');
      console.log('Will attempt to search for and add tracks to YouTube instead of aborting...');
      
      // Instead of aborting, we'll force a search for tracks
      let searchSuccessCount = 0;
      let searchFailCount = 0;
      
      // Process each track and search for YouTube videos
      console.log(`Searching YouTube for ${playlist.tracks.length} tracks...`);
      
      for (const track of playlist.tracks) {
        const searchQuery = encodeURIComponent(`${track.artist} - ${track.title}`);
        console.log(`Searching for: ${track.artist} - ${track.title}`);
        
        try {
          const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
          
          if (!searchResponse.ok) {
            console.error('Failed to search YouTube:', await searchResponse.text());
            searchFailCount++;
            continue;
          }
          
          const searchData = await searchResponse.json();
          if (searchData.items && searchData.items.length > 0) {
            const videoId = searchData.items[0].id?.videoId;
            
            if (videoId) {
              console.log(`Found YouTube match: ${videoId} for "${track.title}"`);
              
              // Update the track with the found YouTube ID
              track.youtubeId = videoId;
              
              // Save the updated track in the database
              if (playlistDocument) {
                try {
                  await Playlist.updateOne(
                    { _id: playlistDocument._id, "tracks._id": track._id },
                    { $set: { "tracks.$.youtubeId": videoId } }
                  );
                } catch (error) {
                  console.error(`Failed to update track with YouTube ID: ${error}`);
                }
              }
              
              // Add the track to the YouTube playlist
              try {
                const addResponse = await fetch(
                  'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      snippet: {
                        playlistId: youtubePlaylistId,
                        resourceId: {
                          kind: 'youtube#video',
                          videoId: videoId
                        }
                      }
                    })
                  }
                );
                
                if (addResponse.ok) {
                  console.log(`Added track to YouTube playlist: ${track.title}`);
                  searchSuccessCount++;
                } else {
                  console.error(`Failed to add video to YouTube playlist:`, await addResponse.text());
                  searchFailCount++;
                }
              } catch (error) {
                console.error(`Error adding video to YouTube playlist: ${error}`);
                searchFailCount++;
              }
            } else {
              console.log(`No video ID found for track: ${track.title}`);
              searchFailCount++;
            }
          } else {
            console.log(`No YouTube results found for: ${track.artist} - ${track.title}`);
            searchFailCount++;
          }
        } catch (error) {
          console.error(`Error searching YouTube: ${error}`);
          searchFailCount++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Now that we've attempted to add all tracks, update the database with any YouTube IDs we found
      if (playlistDocument && searchSuccessCount > 0) {
        await Playlist.findByIdAndUpdate(
          playlistDocument._id,
          { $set: { tracks: playlist.tracks } }
        );
      }
      
      return {
        status: 'success',
        message: `Synced ${searchSuccessCount} tracks to YouTube (${searchFailCount} failed)`,
        success: true,
        youtubeUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`,
        youtubePlaylistId,
        added: searchSuccessCount
      };
    }
    
    // SAFETY CHECK: Don't remove more than 90% of the playlist at once
    if (videosToRemove.length > 0 && currentVideos.length > 0 && 
        (videosToRemove.length / currentVideos.length) > 0.9) {
      console.log('WARNING: Would remove more than 90% of videos from YouTube playlist. Operation aborted.');
      return {
        status: 'warning',
        message: 'Operation would remove more than 90% of videos from YouTube playlist. Sync was aborted to prevent data loss.',
        youtubePlaylistId
      };
    }
    
    // NEW SAFETY CHECK: Don't remove videos if playlist was recently imported
    // Check if the playlist was imported in the last 24 hours and has fewer tracks than YouTube
    const youtubeDataItem = playlist.platformData?.find((p: any) => p.platform === 'youtube');
    const isRecentlyImported = youtubeDataItem && 
                              youtubeDataItem.lastSyncedAt && 
                              new Date().getTime() - new Date(youtubeDataItem.lastSyncedAt).getTime() < 24 * 60 * 60 * 1000;
    
    const hasFewTracks = playlist.tracks.length < currentVideos.length;
    
    if (isRecentlyImported && hasFewTracks && videosToRemove.length > 0) {
      console.log('WARNING: Playlist was recently imported and has fewer tracks than YouTube. Importing missing videos instead of removing them.');
      
      // Import missing videos from YouTube
      const importedCount = await importMissingVideosFromYouTube(playlist, currentVideos, playlistDocument);
      
      return {
        status: 'success',
        message: `Playlist was recently imported. Imported ${importedCount} missing videos from YouTube.`,
        youtubePlaylistId
      };
    }
    
    // Remove tracks from YouTube
    for (const item of videosToRemove) {
      try {
        console.log(`Removing video ${item.contentDetails.videoId} from YouTube playlist`);
        const removeResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?id=${item.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
        
        if (!removeResponse.ok) {
          console.error(`Failed to remove video ${item.contentDetails.videoId}: ${removeResponse.statusText}`);
        }
      } catch (error) {
        console.error(`Error removing video ${item.contentDetails.videoId}:`, error);
      }
    }
    
    // STEP 4: Add tracks from Musync to YouTube
    console.log(`Processing ${playlist.tracks.length} tracks from Musync playlist`);
    let addedCount = 0;
    
    for (const track of playlist.tracks) {
      let videoId = track.youtubeId;
      
      // Skip if video ID already exists in YouTube playlist
      if (videoId && youtubeVideoIds.has(videoId)) {
        console.log(`Track already in YouTube playlist: ${track.title} - ${track.artist}`);
        continue;
      }
      
      // If no YouTube ID, search for the track on YouTube
      if (!videoId) {
        console.log(`Searching YouTube for: ${track.artist} - ${track.title}`);
        try {
          const searchQuery = encodeURIComponent(`${track.artist} - ${track.title}`);
          const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );

          if (!searchResponse.ok) {
            console.error('Failed to search YouTube:', await searchResponse.text());
            continue;
          }

          const searchData = await searchResponse.json();
          if (searchData.items && searchData.items.length > 0) {
            videoId = searchData.items[0].id?.videoId;
            
            if (videoId) {
              console.log(`Found YouTube match: ${videoId} for "${track.title}"`);
              
              // Update the track with the found YouTube ID
              track.youtubeId = videoId;
              
              // Save the updated track in the database immediately
              if (playlistDocument) {
                try {
                  await Playlist.updateOne(
                    { _id: playlistDocument._id, "tracks._id": track._id },
                    { $set: { "tracks.$.youtubeId": videoId } }
                  );
                } catch (error) {
                  console.error(`Failed to update track with YouTube ID: ${error}`);
                }
              }
              
              // Add the track to the YouTube playlist
              try {
                const addResponse = await fetch(
                  'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
                  {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      snippet: {
                        playlistId: youtubePlaylistId,
                        resourceId: {
                          kind: 'youtube#video',
                          videoId: videoId
                        }
                      }
                    })
                  }
                );
                
                if (addResponse.ok) {
                  console.log(`Added track to YouTube playlist: ${track.title}`);
                  addedCount++;
                } else {
                  console.error(`Failed to add video to YouTube playlist:`, await addResponse.text());
                }
              } catch (addError) {
                console.error('Error adding video to YouTube playlist:', addError);
              }
            }
          } else {
            console.log(`No YouTube match found for: ${track.artist} - ${track.title}`);
          }
        } catch (error) {
          console.error('Error searching YouTube:', error);
        }
      }
      
      // If we have a videoId but it's not in the playlist yet, add it
      else if (videoId && !youtubeVideoIds.has(videoId)) {
        try {
          const addResponse = await fetch(
            'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                snippet: {
                  playlistId: youtubePlaylistId,
                  resourceId: {
                    kind: 'youtube#video',
                    videoId: videoId
                  }
                }
              })
            }
          );
          
          if (addResponse.ok) {
            console.log(`Added existing track to YouTube playlist: ${track.title}`);
            addedCount++;
          } else {
            console.error(`Failed to add existing video to YouTube playlist:`, await addResponse.text());
          }
        } catch (addError) {
          console.error('Error adding existing video to YouTube playlist:', addError);
        }
      }
    }
    
    if (addedCount > 0) {
      console.log(`Added ${addedCount} new tracks to YouTube playlist`);
      
      // Save the updated tracks with YouTube IDs
      if (playlistDocument) {
        await Playlist.findByIdAndUpdate(
          playlistDocument._id,
          { $set: { tracks: playlist.tracks } }
        );
      } else {
        await playlist.save();
      }
    }

    // Success return value with playlist URL
    return {
      status: 'success',
      message: `Synchronized with YouTube successfully`,
      youtubePlaylistId,
      success: true,
      youtubeUrl: `https://www.youtube.com/playlist?list=${youtubePlaylistId}`
    };
  } catch (error) {
    console.error('Error syncing with YouTube:', error);
    
    // Attempt to update playlist status to indicate error
    try {
      if (playlistDocument) {
        const updatedPlatformData = playlistDocument.platformData.map((data: any) => {
          if (data.platform === 'youtube') {
            return {
              ...data,
              syncStatus: 'failed',
              syncError: error instanceof Error ? error.message : 'Unknown error',
              lastSyncedAt: new Date()
            };
          }
          return data;
        });
        
        await Playlist.findByIdAndUpdate(
          playlistDocument._id,
          { $set: { platformData: updatedPlatformData } }
        );
      }
    } catch (updateError) {
      console.error('Could not update playlist sync status:', updateError);
    }
    
    return {
      status: 'failed',
      message: `Failed to sync with YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false
    };
  }
}

// Add this helper function for Spotify with refresh token handling
/**
 * Performs a Spotify API request with token refresh handling
 * 
 * @param url - The Spotify API endpoint URL
 * @param accessToken - The current OAuth access token
 * @param options - Additional fetch options
 * @returns The API response and possibly a refreshed token
 */
async function fetchSpotifyWithTokenHandling(
  url: string,
  accessToken: string,
  refreshToken: string | undefined,
  options: RequestInit = {}
): Promise<{ response: Response; refreshedToken?: string }> {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    ...(options.headers || {})
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Check for auth errors (401 Unauthorized or 403 Forbidden)
  if ((response.status === 401 || response.status === 403) && refreshToken) {
    console.log(`Spotify returned ${response.status}, attempting token refresh...`);
    
    try {
      // Force token refresh
      const refreshResponse = await refreshSpotifyToken(refreshToken);
      
      if (refreshResponse.success) {
        console.log('Spotify token refreshed successfully, retrying request with new token');
        
        // Retry the request with the new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${refreshResponse.accessToken}`
          }
        });
        
        return { 
          response: retryResponse, 
          refreshedToken: refreshResponse.accessToken 
        };
      } else {
        console.error('Failed to refresh Spotify token:', refreshResponse.error);
        return { response };
      }
    } catch (error) {
      console.error('Error refreshing Spotify token:', error);
      return { response };
    }
  }
  
  return { response };
}

/**
 * Refreshes a Spotify access token
 * 
 * @param refreshToken - Spotify refresh token
 * @returns Object with success status and either access token or error
 */
async function refreshSpotifyToken(refreshToken: string): Promise<{ 
  success: boolean; 
  accessToken?: string; 
  error?: string 
}> {
  try {
    console.log('Manually refreshing Spotify token...');
    
    // Create refresh token parameters
    const basicAuth = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');
    
    const url = 'https://accounts.spotify.com/api/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    
    // Make the request to refresh the token
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to refresh Spotify token: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      return { 
        success: false, 
        error: `Failed to refresh token: ${response.status} - ${errorText}`
      };
    }
    
    const refreshedTokens = await response.json();
    console.log('Token refreshed successfully!');
    
    return {
      success: true,
      accessToken: refreshedTokens.access_token
    };
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}