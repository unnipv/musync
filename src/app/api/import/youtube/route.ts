import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { google } from 'googleapis';
import { getCachedSession } from '@/lib/session-cache';

// Add a simple in-memory cache for API responses
const CACHE_DURATION = 60000; // 1 minute cache
interface CacheEntry {
  timestamp: number;
  data: any;
}
const responseCache = new Map<string, CacheEntry>();

/**
 * Validates the YouTube access token with Google's API
 * 
 * @param accessToken - The access token to validate
 * @returns An object indicating if the token is valid and any error information
 */
async function validateYouTubeToken(accessToken: string) {
  try {
    // Check cache first for token validation
    const cacheKey = `token_validation_${accessToken.substring(0, 10)}`;
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      return cached.data;
    }
    
    // First test with a basic Google API endpoint
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // If the basic auth failed, token is completely invalid
    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.log(`Google token basic validation failed: ${userInfoResponse.status}, ${errorText}`);
      
      const result = { 
        valid: false, 
        status: userInfoResponse.status,
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
    
    // Basic auth worked, now check YouTube-specific permissions
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });
    
    try {
      // Try a simple call to test YouTube access
      const channelsResponse = await youtube.channels.list({
        part: ['snippet'],
        mine: true
      });
      
      // If we get here, token is valid for YouTube
      const result = { valid: true };
      
      // Cache the result
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    } catch (youtubeError: any) {
      console.log('YouTube API specific check failed:', youtubeError.message);
      
      // Check for authorization issues
      const result = youtubeError.message.includes('insufficient authentication scopes') || 
          youtubeError.message.includes('permission') ||
          youtubeError.message.includes('forbidden')
        ? { 
            valid: false, 
            error: 'Missing YouTube API permissions. Please reconnect with YouTube permissions.',
            needsReconnect: true,
            insufficientScope: true
          }
        : { 
            valid: false, 
            error: youtubeError.message,
            needsReconnect: youtubeError.message.includes('invalid_token') || 
                            youtubeError.message.includes('expired')
          };
      
      // Cache the result
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    }
  } catch (error) {
    console.error('Error validating YouTube token:', error);
    return { valid: false, error: 'Token validation failed' };
  }
}

/**
 * Fetches playlists from YouTube Music for the authenticated user
 * 
 * @param req - The incoming request
 * @returns A response with the user's YouTube Music playlists
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
    
    // Create a cache key based on user ID
    const userId = session.user.id;
    const tokenHash = session.user.googleAccessToken ? 
      session.user.googleAccessToken.substring(0, 10) : 'no-token';
    const cacheKey = `youtube_playlists_${userId}_${tokenHash}`;
    
    // Check if we have a cached response
    const cached = responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log('Using cached YouTube playlists response');
      return NextResponse.json(cached.data);
    }
    
    // Determine if we should use OAuth token or API key
    let useApiKey = false;
    let tokenValidation = { valid: false, error: '', needsReconnect: false };
    
    // First try the OAuth token if available
    if (session.user.googleAccessToken) {
      tokenValidation = await validateYouTubeToken(session.user.googleAccessToken);
      useApiKey = !tokenValidation.valid;
    } else {
      useApiKey = true;
    }
    
    // If OAuth token is invalid and there's an API key available, use it as fallback
    if (useApiKey) {
      console.log('OAuth token invalid or not available. Falling back to API key for public data.');
      
      if (!process.env.YOUTUBE_API_KEY) {
        const errorResponse = { 
          error: 'No YouTube credentials available. Please reconnect your account or contact support.', 
          success: false, 
          needsReconnect: true
        };
        
        // Cache the error response
        responseCache.set(cacheKey, {
          timestamp: Date.now(),
          data: errorResponse
        });
        
        return NextResponse.json(errorResponse, { status: 401 });
      }
      
      try {
        // Use API key for fetching public data
        const apiKeyUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&key=${process.env.YOUTUBE_API_KEY}`;
        
        // Note: We can only fetch public playlists with API key
        // This is just an example request - it won't get user's playlists without proper auth
        const apiKeyResponse = await fetch(apiKeyUrl);
        
        if (!apiKeyResponse.ok) {
          const errorText = await apiKeyResponse.text();
          console.error('YouTube API key request failed:', errorText);
          
          const apiErrorResponse = { 
            error: 'Failed to access YouTube data. Please try again later.', 
            success: false
          };
          
          // Cache the error response
          responseCache.set(cacheKey, {
            timestamp: Date.now(),
            data: apiErrorResponse
          });
          
          return NextResponse.json(apiErrorResponse, { status: 500 });
        }
        
        const apiData = await apiKeyResponse.json();
        
        const successResponse = {
          success: true,
          message: 'Limited functionality mode using API key. Please reconnect your YouTube account for full features.',
          playlists: apiData.items || [],
          usingApiKey: true
        };
        
        // Cache the response
        responseCache.set(cacheKey, {
          timestamp: Date.now(),
          data: successResponse
        });
        
        return NextResponse.json(successResponse);
      } catch (error) {
        console.error('Error fetching data with API key:', error);
        
        const apiErrorResponse = { 
          error: 'Failed to access YouTube. Please try again later.', 
          success: false 
        };
        
        // Cache the error response
        responseCache.set(cacheKey, {
          timestamp: Date.now(),
          data: apiErrorResponse
        });
        
        return NextResponse.json(apiErrorResponse, { status: 500 });
      }
    }
    
    // If token validation failed, return the error
    if (!tokenValidation.valid) {
      console.log('Token validation failed:', tokenValidation);
      
      const validationErrorResponse = { 
        error: tokenValidation.error || 'YouTube access token is invalid. Please reconnect your account.', 
        success: false, 
        needsReconnect: !!tokenValidation.needsReconnect,
        insufficientScope: !!(tokenValidation as any).insufficientScope
      };
      
      // Cache the error response
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: validationErrorResponse
      });
      
      return NextResponse.json(validationErrorResponse, { status: 401 });
    }
    
    try {
      // Configure Google API client with the user's access token
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: session.user.googleAccessToken
      });
      
      // Create YouTube API client
      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client
      });
      
      // Get user playlists from YouTube
      const response = await youtube.playlists.list({
        part: ['snippet', 'contentDetails'],
        maxResults: 50,
        mine: true
      });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('YouTube API raw response status:', {
          status: response.status,
          statusText: response.statusText,
          data: {
            pageInfo: response.data.pageInfo,
            itemCount: response.data.items?.length || 0
          }
        });
      }
      
      if (!response.data) {
        throw new Error('Invalid response from YouTube API');
      }
      
      // Shape the playlist data to match our application format
      const playlists = response.data.items?.map((item: any) => ({
        id: item.id || '',
        name: item.snippet?.title || 'Untitled Playlist',
        description: item.snippet?.description || '',
        images: item.snippet?.thumbnails ? [
          {
            url: item.snippet.thumbnails.high?.url || 
                 item.snippet.thumbnails.medium?.url || 
                 item.snippet.thumbnails.default?.url || ''
          }
        ] : [],
        tracks: {
          total: item.contentDetails?.itemCount || 0
        },
        external_urls: {
          youtube: `https://www.youtube.com/playlist?list=${item.id}`
        },
        owner: {
          display_name: item.snippet?.channelTitle || 'Unknown'
        },
        platform: 'youtube'
      })) || [];
      
      if (process.env.NODE_ENV !== 'production') {
        // Log the processed playlists for debugging
        console.log('Processed YouTube playlists:', {
          count: playlists.length,
          firstPlaylist: playlists[0] ? {
            id: playlists[0].id,
            name: playlists[0].name,
            trackCount: playlists[0].tracks.total,
            hasImages: playlists[0].images && playlists[0].images.length > 0
          } : 'No playlists found'
        });
        
        // Also log the complete first playlist for debugging if available
        if (playlists[0]) {
          console.log('Complete first YouTube playlist sample:', 
            JSON.stringify(playlists[0], null, 2).substring(0, 1000) + 
            (JSON.stringify(playlists[0]).length > 1000 ? '... (truncated)' : ''));
        }
      }
      
      const responseData = {
        success: true,
        playlists
      };
      
      // Cache the successful response
      responseCache.set(cacheKey, {
        timestamp: Date.now(),
        data: responseData
      });
      
      return NextResponse.json(responseData);
      
    } catch (error) {
      // Handle YouTube API specific errors
      if (error instanceof Error) {
        // Extract the error message
        const errorMessage = error.message;
        
        if (errorMessage.includes('invalid_token') || 
            errorMessage.includes('Invalid Credentials') || 
            errorMessage.includes('token expired')) {
          console.error('YouTube API auth error:', errorMessage);
          return NextResponse.json(
            { error: 'Google access token expired. Please reconnect your account.', success: false, needsReconnect: true },
            { status: 401 }
          );
        }
        
        // Handle insufficient scope errors
        if (errorMessage.includes('insufficient authentication scopes') || 
            errorMessage.includes('permission') ||
            errorMessage.includes('forbidden')) {
          console.error('YouTube API permission error:', errorMessage);
          return NextResponse.json(
            { 
              error: 'Missing YouTube API permissions. Please reconnect your account with the required permissions.', 
              success: false, 
              needsReconnect: true,
              insufficientScope: true
            },
            { status: 403 }
          );
        }
      }
      
      console.error('Error fetching YouTube playlists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch YouTube playlists. Please try again.', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    // Check for database connection errors
    if (error instanceof Error && 
        (error.message.includes('MongoServerSelectionError') || 
         error.message.includes('SSL routines') ||
         error.message.includes('MongoNetworkError'))) {
      console.warn('Database connection error in YouTube import API:', error);
      // If we have a database connection error but have a valid session with tokens,
      // we can still try to proceed with the API request to YouTube
      if (req.headers.get('Cookie')?.includes('next-auth.session-token')) {
        console.log('Attempting to proceed with YouTube API request despite database error');
        try {
          // Extract auth info from cookies if possible and make a direct API call
          // Note: This is a fallback for when MongoDB is down but the session is still valid
          return NextResponse.json({
            success: true,
            playlists: [],
            message: 'Database connection issue. Please try refreshing your connection.'
          });
        } catch (youtubeError) {
          console.error('Failed to fetch YouTube playlists in database error fallback:', youtubeError);
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
    
    console.error('Error in YouTube import API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', success: false },
      { status: 500 }
    );
  }
}

/**
 * Imports a playlist from YouTube Music
 * 
 * @param req - The incoming request with YouTube playlist details
 * @returns A response indicating the success of the import
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!session.user.googleAccessToken) {
      return NextResponse.json(
        { error: 'No Google access token available', success: false },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const { youtubePlaylistId } = body;
    
    if (!youtubePlaylistId) {
      return NextResponse.json(
        { error: 'YouTube playlist ID is required' },
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
    
    // Check if the user has a Google account
    const hasGoogleAccount = user.accounts?.some(
      (acc: any) => acc.platform === 'google'
    );
    
    if (!hasGoogleAccount) {
      return NextResponse.json(
        { error: 'Google account not connected', success: false },
        { status: 400 }
      );
    }
    
    try {
      console.log(`Importing YouTube playlist: ${youtubePlaylistId}`);
      
      // Step 1: Fetch the playlist details
      const youtubeResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${youtubePlaylistId}`,
        {
          headers: {
            Authorization: `Bearer ${session.user.googleAccessToken}`,
            'Cache-Control': 'no-cache'
          }
        }
      );
      
      if (!youtubeResponse.ok) {
        const errorData = await youtubeResponse.json();
        console.error('YouTube API error:', errorData);
        
        if (youtubeResponse.status === 401) {
          return NextResponse.json(
            { error: 'Google access token expired. Please reconnect your account.', success: false },
            { status: 401 }
          );
        }
        
        throw new Error(`YouTube API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const youtubeData = await youtubeResponse.json();
      const playlist = youtubeData.items?.[0];
      
      if (!playlist) {
        return NextResponse.json(
          { error: 'YouTube playlist not found', success: false },
          { status: 404 }
        );
      }
      
      // Step 2: Fetch the playlist items (tracks)
      console.log(`Fetching tracks for YouTube playlist: ${youtubePlaylistId}`);
      const playlistTracks: any[] = [];
      let nextPageToken: string | null = null;
      
      do {
        const pageUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${youtubePlaylistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        
        const videosResponse = await fetch(pageUrl, {
          headers: {
            Authorization: `Bearer ${session.user.googleAccessToken}`,
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!videosResponse.ok) {
          const errorText = await videosResponse.text();
          console.error('Failed to get tracks from YouTube playlist:', errorText);
          throw new Error(`Failed to get tracks from YouTube playlist: ${errorText}`);
        }
        
        const videosData = await videosResponse.json();
        if (videosData.items && videosData.items.length > 0) {
          playlistTracks.push(...videosData.items);
        }
        
        nextPageToken = videosData.nextPageToken || null;
      } while (nextPageToken);
      
      console.log(`Found ${playlistTracks.length} tracks in YouTube playlist`);
      
      // Step 3: Format tracks for our database
      const tracks = playlistTracks.map(video => ({
        title: video.snippet?.title || '',
        artist: video.snippet?.videoOwnerChannelTitle || '',
        duration: 0, // YouTube API doesn't directly provide duration in this response
        youtubeId: video.contentDetails?.videoId || video.id?.videoId || video.snippet?.resourceId?.videoId,
        addedAt: new Date(video.snippet?.publishedAt || Date.now()),
        updatedAt: new Date(),
        platformData: [
          {
            platform: 'youtube',
            id: video.contentDetails?.videoId || video.id?.videoId || video.snippet?.resourceId?.videoId,
            status: 'synced'
          }
        ]
      }));
      
      // Step 4: Create a new Musync playlist with tracks
      const newPlaylist = {
        userId: new ObjectId(session.user.id),
        name: playlist.snippet.title,
        description: playlist.snippet.description || '',
        image: playlist.snippet.thumbnails?.high?.url || '',
        tracks: tracks, // Include the tracks we fetched
        platformData: [
          {
            platform: 'youtube',
            id: youtubePlaylistId,
            platformId: youtubePlaylistId,
            syncStatus: 'synced', // Mark as synced since we imported all tracks
            lastSyncedAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('playlists').insertOne(newPlaylist);
      
      return NextResponse.json({
        success: true,
        message: `Playlist imported successfully with ${tracks.length} tracks`,
        playlistId: result.insertedId,
        trackCount: tracks.length
      });
    } catch (error) {
      console.error('Error importing YouTube playlist:', error);
      return NextResponse.json(
        { error: 'Failed to import playlist from YouTube', success: false },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in YouTube import API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', success: false },
      { status: 500 }
    );
  }
} 