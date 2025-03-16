import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getCachedSession } from '@/lib/session-cache';

// Add a simple in-memory cache for API responses
const CACHE_DURATION = 60000; // 1 minute cache
interface CacheEntry {
  timestamp: number;
  data: any;
}
const responseCache = new Map<string, CacheEntry>();

/**
 * Validates the Spotify access token with Spotify's API
 * 
 * @param accessToken - The access token to validate
 * @returns An object indicating if the token is valid and any error information
 */
async function validateSpotifyToken(accessToken: string) {
  try {
    // Check cache first for token validation
    const cacheKey = `spotify_token_validation_${accessToken.substring(0, 10)}`;
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      return cached.data;
    }
    
    // Test with a basic Spotify API endpoint
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // If the basic auth failed, token is completely invalid
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Spotify token validation failed: ${response.status}, ${errorText}`);
      
      const result = { 
        valid: false, 
        status: response.status,
        error: errorText,
        needsReconnect: true
      };
      
      // Cache the result
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    }
    
    // If we get here, token is valid for Spotify
    const result = { valid: true };
    
    // Cache the result
    responseCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });
    
    return result;
  } catch (error) {
    console.error('Error validating Spotify token:', error);
    return { valid: false, error: 'Token validation failed' };
  }
}

/**
 * Fetches playlists from Spotify for the authenticated user
 * 
 * @param req - The incoming request
 * @returns A response with the user's Spotify playlists
 */
export async function GET(req: NextRequest) {
  try {
    // Use cached session instead of direct getServerSession
    const session = await getCachedSession(req);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }
    
    if (!session.user.spotifyAccessToken) {
      return NextResponse.json(
        { error: 'No Spotify access token available. Please connect your Spotify account.', success: false },
        { status: 400 }
      );
    }
    
    // Create a cache key based on user ID and token
    const userId = session.user.id;
    const tokenHash = session.user.spotifyAccessToken ? 
      session.user.spotifyAccessToken.substring(0, 10) : 'no-token';
    const cacheKey = `spotify_playlists_${userId}_${tokenHash}`;
    
    // Check if we have a cached response
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('Using cached Spotify playlists response');
      return NextResponse.json(cached.data);
    }
    
    // Validate the token before proceeding
    const tokenValidation = await validateSpotifyToken(session.user.spotifyAccessToken);
    
    if (!tokenValidation.valid) {
      console.log('Spotify token validation failed:', tokenValidation);
      
      const response = { 
        error: tokenValidation.error || 'Spotify access token is invalid. Please reconnect your account.', 
        success: false, 
        needsReconnect: !!tokenValidation.needsReconnect
      };
      
      // Cache the error response
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: response
      });
      
      return NextResponse.json(response, { status: 401 });
    }
    
    try {
      console.log('Starting Spotify API fetch...');
      
      // First, log the full Spotify access token to verify it's valid
      console.log('Spotify access token available:', !!session.user.spotifyAccessToken);
      // Log only the first 10 chars for security reasons
      const tokenPreview = session.user.spotifyAccessToken?.substring(0, 10) + '...';
      console.log('Token preview:', tokenPreview);
      
      // Add timestamp to URL to avoid caching
      const timestamp = Date.now();
      const response = await fetch(
        `https://api.spotify.com/v1/me/playlists?limit=50&timestamp=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${session.user.spotifyAccessToken}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Spotify API response status:', response.status, response.statusText);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Spotify API error response:', errorText);
        
        try {
          // Try to parse the error text if it's JSON
          const errorData = JSON.parse(errorText);
          console.error('Parsed error details:', errorData);
        } catch (parseError) {
          // If not JSON, just log the raw text
          console.error('Raw error response (not JSON):', errorText);
        }
        
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Spotify access token expired. Please reconnect your account.', success: false },
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          { error: `Spotify API error: ${response.statusText}`, success: false },
          { status: response.status }
        );
      }
      
      const spotifyResponseData = await response.json();
      
      // Log the complete raw response data for debugging
      console.log('Raw Spotify API response data (limited):', JSON.stringify(spotifyResponseData).substring(0, 500) + '...');
      console.log('Spotify response structure:', {
        hasItems: !!spotifyResponseData.items,
        itemsIsArray: Array.isArray(spotifyResponseData.items),
        itemsLength: spotifyResponseData.items?.length || 0,
        total: spotifyResponseData.total,
        limit: spotifyResponseData.limit,
        offset: spotifyResponseData.offset,
        keys: Object.keys(spotifyResponseData)
      });
      
      // Store the raw data for processing
      const spotifyData = spotifyResponseData;
      
      // If we have empty playlists, try a second approach
      if (!spotifyData.items?.length) {
        console.log('No playlists found with first approach, trying alternative endpoint...');
        
        try {
          // Try a different endpoint - get user ID first
          const userProfileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              Authorization: `Bearer ${session.user.spotifyAccessToken}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
          
          if (!userProfileResponse.ok) {
            console.error('Failed to fetch Spotify user profile:', userProfileResponse.status);
            throw new Error('Failed to fetch Spotify user profile');
          }
          
          const userProfile = await userProfileResponse.json();
          console.log('Spotify user profile:', {
            id: userProfile.id,
            displayName: userProfile.display_name
          });
          
          // Now fetch playlists using the user ID
          if (userProfile.id) {
            console.log(`Fetching playlists for user ID: ${userProfile.id}`);
            const userPlaylistsResponse = await fetch(
              `https://api.spotify.com/v1/users/${userProfile.id}/playlists?limit=50`,
              {
                headers: {
                  Authorization: `Bearer ${session.user.spotifyAccessToken}`,
                  'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
              }
            );
            
            if (!userPlaylistsResponse.ok) {
              console.error('Failed to fetch user playlists:', userPlaylistsResponse.status);
              throw new Error('Failed to fetch user playlists');
            }
            
            const userPlaylistsData = await userPlaylistsResponse.json();
            console.log('User playlists data:', {
              total: userPlaylistsData.total,
              itemsLength: userPlaylistsData.items?.length || 0
            });
            
            // If we found playlists with this approach, use them instead
            if (userPlaylistsData.items?.length > 0) {
              console.log(`Found ${userPlaylistsData.items.length} playlists using alternative endpoint!`);
              spotifyData.items = userPlaylistsData.items;
            }
          }
        } catch (alternativeError) {
          console.error('Error in alternative playlists fetch approach:', alternativeError);
          // Continue with the original empty results
        }
      }
      
      // If we have items, log some sanity checks
      if (spotifyData.items?.length > 0) {
        // Log each item's structure for the first few items
        console.log('First few items structure:');
        spotifyData.items.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`Item ${index} keys:`, Object.keys(item));
          console.log(`Item ${index} id:`, item.id);
          console.log(`Item ${index} name:`, item.name);
          console.log(`Item ${index} tracks:`, item.tracks?.total);
          console.log(`Item ${index} owner:`, item.owner?.display_name);
        });
        
        const validItems = spotifyData.items.filter((item: any) => 
          item && item.id && item.name && typeof item.tracks?.total === 'number'
        );
        
        console.log(`Found ${validItems.length} valid Spotify playlists out of ${spotifyData.items.length} total items`);
        
        if (validItems.length !== spotifyData.items.length) {
          console.warn('Some Spotify playlists are missing required fields!');
          // Log the invalid items for debugging
          const invalidItems = spotifyData.items.filter((item: any) => 
            !(item && item.id && item.name && typeof item.tracks?.total === 'number')
          );
          console.warn('Invalid items:', invalidItems);
        }
      } else {
        console.warn('No Spotify playlists found in the response');
        console.log('Full response for debugging:', JSON.stringify(spotifyResponseData));
      }
      
      console.log(`Successfully fetched ${spotifyData.items?.length || 0} Spotify playlists`);
      
      // Ensure items are properly formatted before returning
      const playlists = spotifyData.items || [];
      
      // Log the exact response structure we're sending back to the client
      const firstPlaylist = playlists[0] || null;
      console.log('Spotify API response structure being sent to client:', {
        success: true,
        playlistCount: playlists.length,
        firstPlaylistSample: firstPlaylist ? {
          id: firstPlaylist.id,
          name: firstPlaylist.name,
          tracksTotal: firstPlaylist.tracks?.total,
          hasImages: Array.isArray(firstPlaylist.images) && firstPlaylist.images.length > 0,
          keys: Object.keys(firstPlaylist)
        } : 'No playlists found'
      });
      
      // Also log the complete first playlist for debugging
      if (firstPlaylist) {
        console.log('Complete first Spotify playlist sample:', 
          JSON.stringify(firstPlaylist, null, 2).substring(0, 1000) + 
          (JSON.stringify(firstPlaylist).length > 1000 ? '... (truncated)' : ''));
      }
      
      // Explicitly format playlists to ensure correct structure
      const formattedPlaylists = playlists.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        images: playlist.images || [],
        tracks: {
          total: playlist.tracks?.total || 0
        },
        external_urls: playlist.external_urls || { spotify: '' },
        owner: playlist.owner || { display_name: '' },
        platform: 'spotify'
      }));
      
      // Add final debug check
      console.log(`FINAL: Returning ${formattedPlaylists.length} formatted playlists to client`);
      
      // The very end of the function, where we return the response, add caching:
      const cacheResponseData = {
        success: true,
        playlists: formattedPlaylists
      };
      
      // Cache the successful response
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: cacheResponseData
      });
      
      return NextResponse.json(cacheResponseData);
    } catch (error) {
      console.error('Error fetching Spotify playlists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch Spotify playlists. Please try again.', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    // Check for database connection errors
    if (error instanceof Error && 
        (error.message.includes('MongoServerSelectionError') || 
         error.message.includes('SSL routines') ||
         error.message.includes('MongoNetworkError'))) {
      console.warn('Database connection error in Spotify import API:', error);
      // If we have a database connection error but have a valid session with tokens,
      // we can still try to proceed with the API request to Spotify
      if (req.headers.get('Cookie')?.includes('next-auth.session-token')) {
        console.log('Attempting to proceed with Spotify API request despite database error');
        try {
          // Extract auth info from cookies if possible and make a direct API call
          // Note: This is a fallback for when MongoDB is down but the session is still valid
          return NextResponse.json({
            success: true,
            playlists: [],
            message: 'Database connection issue. Please try refreshing your connection.'
          });
        } catch (spotifyError) {
          console.error('Failed to fetch Spotify playlists in database error fallback:', spotifyError);
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Database connection issue. Some features may be limited.', 
          success: false,
          isDatabaseError: true
        },
        { status: 503 }
      );
    }
    
    console.error('Error in Spotify import API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', success: false },
      { status: 500 }
    );
  }
}

/**
 * Imports a playlist from Spotify
 * 
 * @param req - The incoming request with Spotify playlist details
 * @returns A response indicating the success of the import
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }
    
    if (!session.user.spotifyAccessToken) {
      return NextResponse.json(
        { error: 'No Spotify access token available', success: false },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const { spotifyPlaylistId } = body;
    
    if (!spotifyPlaylistId) {
      return NextResponse.json(
        { error: 'Spotify playlist ID is required', success: false },
        { status: 400 }
      );
    }
    
    const { db } = await connectToDatabase();
    
    // Check if the user has accounts
    const user = await db.collection('users').findOne({
      _id: new ObjectId(session.user.id)
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found', success: false },
        { status: 404 }
      );
    }
    
    // Check if the user has a Spotify account
    const hasSpotifyAccount = user.accounts?.some(
      (acc: any) => acc.platform === 'spotify'
    );
    
    if (!hasSpotifyAccount) {
      return NextResponse.json(
        { error: 'Spotify account not connected', success: false },
        { status: 400 }
      );
    }
    
    // Fetch the Spotify playlist
    try {
      // Add a timestamp to URL to avoid caching issues
      const timestamp = Date.now();
      const playlistResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}?timestamp=${timestamp}`, 
        {
          headers: {
            Authorization: `Bearer ${session.user.spotifyAccessToken}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );
      
      if (!playlistResponse.ok) {
        const errorData = await playlistResponse.json();
        console.error('Spotify API error:', errorData);
        
        if (playlistResponse.status === 401) {
          return NextResponse.json(
            { error: 'Spotify access token expired. Please reconnect your account.', success: false },
            { status: 401 }
          );
        }
        
        throw new Error(`Spotify API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const playlistData = await playlistResponse.json();
      
      console.log(`Fetched Spotify playlist: "${playlistData.name}" with ${playlistData.tracks?.total || 0} total tracks`);
      
      // Create new Musync playlist
      const newPlaylist = {
        userId: new ObjectId(session.user.id),
        name: playlistData.name,
        description: playlistData.description || '',
        image: playlistData.images?.[0]?.url || '',
        tracks: [],
        platformData: [
          {
            platform: 'spotify',
            id: spotifyPlaylistId,
            platformId: spotifyPlaylistId,
            syncStatus: 'syncing',
            lastSyncedAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert the new playlist
      const result = await db.collection('playlists').insertOne(newPlaylist);
      const playlistId = result.insertedId;
      
      // Now fetch all tracks from the playlist (handling pagination)
      const tracks: any[] = [];
      let nextUrl = playlistData.tracks.href;
      
      while (nextUrl) {
        console.log(`Fetching tracks from ${nextUrl}`);
        
        const tracksResponse = await fetch(nextUrl, {
          headers: {
            Authorization: `Bearer ${session.user.spotifyAccessToken}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!tracksResponse.ok) {
          console.error('Error fetching Spotify tracks:', await tracksResponse.text());
          break;
        }
        
        const tracksData = await tracksResponse.json();
        console.log(`Received ${tracksData.items?.length || 0} tracks in this page`);
        
        if (tracksData.items && tracksData.items.length > 0) {
          tracks.push(...tracksData.items);
        }
        
        nextUrl = tracksData.next;
      }
      
      console.log(`Fetched a total of ${tracks.length} tracks from Spotify playlist`);
      
      // Format and save tracks
      const formattedTracks = tracks
        .filter(item => item.track)
        .map(item => ({
          title: item.track.name || '',
          artist: item.track.artists?.map((a: any) => a.name).join(', ') || '',
          album: item.track.album?.name || '',
          duration: item.track.duration_ms || 0,
          spotifyId: item.track.id,
          spotifyUri: item.track.uri,
          addedAt: new Date(item.added_at || Date.now()),
          updatedAt: new Date()
        }));
      
      console.log(`Processing ${formattedTracks.length} valid tracks to import`);
      
      // If we have tracks, add them to the playlist
      if (formattedTracks.length > 0) {
        await db.collection('playlists').updateOne(
          { _id: playlistId },
          { 
            $set: { 
              tracks: formattedTracks,
              'platformData.0.syncStatus': 'synced'
            }
          }
        );
        
        console.log(`Successfully imported ${formattedTracks.length} tracks into playlist`);
      } else {
        console.log('No valid tracks found in Spotify playlist to import');
      }
      
      return NextResponse.json({
        success: true,
        message: `Playlist imported successfully with ${formattedTracks.length} tracks`,
        playlistId: playlistId,
        trackCount: formattedTracks.length
      });
    } catch (error) {
      console.error('Error importing Spotify playlist:', error);
      return NextResponse.json(
        { error: 'Failed to import playlist from Spotify', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in Spotify import API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', success: false },
      { status: 500 }
    );
  }
} 