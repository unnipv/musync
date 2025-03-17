import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import logger from '@/lib/logger';

/**
 * Interface for platform connection states
 */
export interface PlatformConnections {
  spotify: boolean;
  youtube: boolean;
}

/**
 * Interface for platform-specific data
 */
interface PlatformData {
  spotify: any[];
  youtube: any[];
}

/**
 * Interface for the hook return value
 */
interface UsePlatformConnectionsReturn {
  connections: PlatformConnections;
  isCheckingConnection: boolean;
  playlists: PlatformData;
  isImporting: boolean;
  error: string;
  message: string;
  setError: (error: string) => void;
  setMessage: (message: string) => void;
  setConnections: React.Dispatch<React.SetStateAction<PlatformConnections>>;
  setPlaylists: React.Dispatch<React.SetStateAction<PlatformData>>;
  checkConnections: () => Promise<void>;
  fetchSpotifyPlaylists: (setLoading?: boolean) => Promise<void>;
  fetchYoutubePlaylists: (setLoading?: boolean) => Promise<void>;
}

interface SpotifyPlaylistsResponse {
  success: boolean;
  playlists: any[];
  error?: string;
}

/**
 * Interface for a Spotify playlist item
 */
interface SpotifyPlaylistItem {
  id: string;
  name: string;
  tracks?: {
    total: number;
  };
  images?: { url: string }[];
  platform: string;
  [key: string]: any;
}

/**
 * Interface for a YouTube playlist item
 */
interface YouTubePlaylistItem {
  id: string;
  name: string;
  tracks?: {
    total: number;
  };
  images?: { url: string }[];
  platform: string;
  [key: string]: any;
}

// Add cache interface
interface CacheData {
  timestamp: number;
  data: any[];
}

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION_TIME = 5 * 60 * 1000;

/**
 * Utility function to handle database connection errors
 * 
 * @param error - The error object
 * @returns A user-friendly error message
 */
function handleDatabaseError(error: any): string {
  // Check for MongoDB SSL/TLS errors
  if (error?.message?.includes('SSL routines') || error?.message?.includes('MongoServerSelectionError')) {
    logger.warn('Database connection error detected. Proceeding in offline mode.', error);
    return 'Database connection issue detected. Some features may be limited.';
  }
  
  // Handle other known error types
  if (error?.name === 'MongoNetworkError') {
    return 'Network error connecting to database. Please check your connection.';
  }
  
  // Default error message
  return 'An unexpected error occurred. Please try again later.';
}

/**
 * Checks if the error is a database connection error
 * @param error - The error to check
 */
const isDatabaseError = (error: any): boolean => {
  return !!(error && 
    typeof error === 'object' && 
    (error.name === 'MongoNetworkError' || 
     error.name === 'MongoServerSelectionError' || 
     error.message?.includes('SSL routines') ||
     error.message?.includes('tlsv1 alert') ||
     error.message?.includes('MongoDB connection') ||
     error.message?.includes('ENOTFOUND') ||
     error.message?.includes('timeout') ||
     error.message?.includes('offline mode')));
};

/**
 * Handle common database connection errors in playlist fetching
 * 
 * @param err - The error object
 * @param setError - Function to set error state
 * @param platform - The platform name for logging
 */
const handlePlaylistFetchError = (err: any, setError: (message: string) => void, platform: string) => {
  logger.error(`Error fetching ${platform} playlists:`, err);
  
  // Check for database connection errors
  if (err.message && (
      err.message.includes('database') || 
      err.message.includes('MongoDB') ||
      err.message.includes('SSL routines'))) {
    setError('Database connection issues detected. Some features may be limited, but you can still browse your connected accounts.');
  }
};

/**
 * Custom hook to manage platform connections and associated data
 * 
 * @returns Connection states and functions to manage platform data
 */
export const usePlatformConnections = (): UsePlatformConnectionsReturn => {
  const { data: session, status } = useSession();
  const [connections, setConnections] = useState<PlatformConnections>({
    spotify: false,
    youtube: false
  });
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);
  const [playlists, setPlaylists] = useState<PlatformData>({
    spotify: [],
    youtube: []
  });
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  
  // Add refs for debouncing and caching
  const youtubeRequestRef = useRef<NodeJS.Timeout | null>(null);
  const spotifyRequestRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Record<string, CacheData>>({});
  const isLoadingRef = useRef<Record<string, boolean>>({
    youtube: false,
    spotify: false
  });

  // Check if cache is valid
  const isCacheValid = useCallback((platform: string): boolean => {
    const cache = cacheRef.current[platform];
    if (!cache) return false;
    
    const now = Date.now();
    return now - cache.timestamp < CACHE_EXPIRATION_TIME;
  }, []);

  /**
   * Handles fallback direct API fetch for YouTube when database is down
   * @returns Array of YouTube playlists
   */
  const fetchYoutubePlaylistsDirectly = async (): Promise<any[]> => {
    if (!session?.user?.googleAccessToken) {
      console.warn('No Google token available for direct YouTube API call');
      return [];
    }
    
    try {
      logger.debug('Attempting direct YouTube API call as fallback...');
      
      // Try direct call using googleapis library
      const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true', {
        headers: {
          'Authorization': `Bearer ${session.user.googleAccessToken}`,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Format the response to match our app's format
      return data.items?.map((item: any) => ({
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
    } catch (error) {
      console.error('Error in direct YouTube API call:', error);
      return [];
    }
  };

  /**
   * Fetches playlists from YouTube Music with debouncing and caching
   * 
   * @param setLoading - Whether to set loading state (default: true)
   * @returns A promise that resolves when playlists are fetched
   */
  const fetchYoutubePlaylists = useCallback(async (setLoading = true) => {
    try {
      // Check if we're already loading
      if (isLoadingRef.current.youtube) {
        logger.debug('YouTube playlists fetch already in progress, skipping duplicate request');
        return;
      }
      
      // Clear any pending requests
      if (youtubeRequestRef.current) {
        clearTimeout(youtubeRequestRef.current);
      }
      
      // Check cache first
      if (isCacheValid('youtube')) {
        logger.debug('Using cached YouTube playlists data');
        setPlaylists(prev => ({...prev, youtube: cacheRef.current.youtube.data}));
        return;
      }
      
      // Debounce the request
      youtubeRequestRef.current = setTimeout(async () => {
        try {
          isLoadingRef.current.youtube = true;
          
          if (setLoading) {
            setIsImporting(true);
            setError('');
          }
          
          logger.debug('Fetching YouTube playlists...');
          logger.debug('Session status:', status);
          logger.debug('Has Google token:', !!session?.user?.googleAccessToken);
          
          // Add a timestamp to prevent caching
          const timestamp = Date.now();
          const response = await fetch(`/api/import/youtube?t=${timestamp}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          // Log response status for debugging
          logger.debug('YouTube playlists API response status:', { 
            status: response.status, 
            statusText: response.statusText 
          });
          
          // Clone the response before parsing it to avoid consuming the body
          const responseClone = response.clone();
          
          // Try to parse the JSON response
          let data: { success: boolean; playlists: any[]; error?: string; isDatabaseError?: boolean };
          try {
            data = await response.json();
            // Ensure playlists is always an array
            if (!data.playlists) {
              data.playlists = [];
            }
          } catch (jsonError) {
            // If we can't parse JSON, try to get the text content
            const textContent = await responseClone.text();
            logger.error('Failed to parse YouTube API response as JSON:', textContent);
            
            // Try direct API call as fallback for database errors
            if (textContent.includes('database') || textContent.includes('MongoDB') || 
                textContent.includes('SSL routines') || textContent.includes('offline')) {
              logger.info('Database error detected, attempting direct API call');
              // Use the local fetchYoutubePlaylistsDirectly function without params
              const directPlaylists = await fetchYoutubePlaylistsDirectly();
              
              if (directPlaylists.length > 0) {
                logger.info(`Found ${directPlaylists.length} YouTube playlists via direct API call`);
                setPlaylists(prev => ({...prev, youtube: directPlaylists}));
                setConnections(prev => ({...prev, youtube: true}));
                if (setLoading) {
                  setError('Database connection issue. Using direct API access with limited functionality.');
                  setIsImporting(false);
                }
                return;
              }
            }
            
            throw new Error('Invalid response format from YouTube API');
          }
          
          logger.debug('YouTube playlists API client response:', {
            success: data.success,
            playlistCount: data.playlists?.length || 0,
            playlistSample: data.playlists?.[0] ? {
              id: data.playlists[0].id,
              name: data.playlists[0].name,
              trackCount: data.playlists[0].tracks?.total || 'unknown'
            } : 'No playlists'
          });
          
          if (response.ok && data.success) {
            // After successful fetch, update cache
            cacheRef.current.youtube = {
              timestamp: Date.now(),
              data: data.playlists
            };
            setPlaylists(prev => ({...prev, youtube: data.playlists}));
            
            // Update connection status
            setConnections(prev => ({...prev, youtube: true}));
          } else {
            const errorMessage = data.error || 'Failed to fetch YouTube playlists';
            console.error('YouTube playlists API error:', errorMessage);
            
            // Try direct API call for database errors
            if ((errorMessage.includes('database') || errorMessage.includes('MongoDB') || 
                errorMessage.includes('SSL routines') || data.isDatabaseError) && 
                session?.user?.googleAccessToken) {
              console.log('Database error reported by API, trying direct API call');
              // Use the local fetchYoutubePlaylistsDirectly function without params
              const directPlaylists = await fetchYoutubePlaylistsDirectly();
              
              if (directPlaylists.length > 0) {
                console.log(`Found ${directPlaylists.length} YouTube playlists via direct API call`);
                setPlaylists(prev => ({...prev, youtube: directPlaylists}));
                setConnections(prev => ({...prev, youtube: true}));
                if (setLoading) {
                  setError('Database connection issue. Using direct API access with limited functionality.');
                  setIsImporting(false);
                }
                return;
              }
            }
            
            // Specific error handling based on the error message
            if (errorMessage.includes('not connected')) {
              setConnections(prev => ({ ...prev, youtube: false }));
            } else if (errorMessage.includes('token') || errorMessage.includes('401')) {
              setConnections(prev => ({ ...prev, youtube: false }));
              setError(`YouTube connection error: ${errorMessage}. Please reconnect.`);
            } else {
              setError(`YouTube error: ${errorMessage}`);
            }
          }
        } finally {
          isLoadingRef.current.youtube = false;
          if (setLoading) {
            setIsImporting(false);
          }
        }
      }, 300); // 300ms debounce
    } catch (error) {
      console.error('Error in fetchYoutubePlaylists:', error);
      if (setLoading) {
        setIsImporting(false);
        setError('Failed to fetch YouTube playlists. Please try again.');
      }
      isLoadingRef.current.youtube = false;
    }
  }, [session, status, isCacheValid]);
  
  /**
   * Fetches playlists from Spotify
   * 
   * @param setLoading - Whether to set loading state (default: true)
   * @returns A promise that resolves when playlists are fetched
   */
  const fetchSpotifyPlaylists = useCallback(async (setLoading = true) => {
    try {
      if (setLoading) {
        setIsImporting(true);
        setError('');
      }
      
      logger.debug('Fetching Spotify playlists...');
      logger.debug('Session status:', status);
      logger.debug('Has Spotify token:', !!session?.user?.spotifyAccessToken);
      
      // Add a timestamp to prevent caching
      const timestamp = Date.now();
      const response = await fetch(`/api/import/spotify?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // Log the status and status text before parsing the response
      logger.debug('Spotify playlists API response status:', { 
        status: response.status, 
        statusText: response.statusText 
      });
      
      // Clone the response before parsing it to avoid consuming the body
      const responseClone = response.clone();
      
      // Try to parse the JSON response
      let data: SpotifyPlaylistsResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If we can't parse JSON, try to get the text content
        const textContent = await responseClone.text();
        console.error('Failed to parse Spotify API response as JSON:', textContent);
        throw new Error('Invalid response format from Spotify API');
      }
      
      logger.debug('Spotify playlists API client response:', {
        success: data.success,
        playlistCount: data.playlists?.length || 0,
        playlistSample: data.playlists?.[0] ? {
          id: data.playlists[0].id,
          name: data.playlists[0].name,
          trackCount: data.playlists[0].tracks?.total || 'unknown'
        } : 'No playlists'
      });
      
      // If we got a successful response but no playlists, try direct API call
      if (response.ok && data.success && (!data.playlists || data.playlists.length === 0)) {
        logger.info('Received empty playlists from backend, trying direct API call...');
        
        if (session?.user?.spotifyAccessToken) {
          try {
            // First get the user profile
            const profileResponse = await fetch('https://api.spotify.com/v1/me', {
              headers: {
                'Authorization': `Bearer ${session.user.spotifyAccessToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            });
            
            if (!profileResponse.ok) {
              console.error('Direct Spotify profile API error:', profileResponse.status);
              throw new Error(`Failed to get Spotify profile: ${profileResponse.statusText}`);
            }
            
            const profileData = await profileResponse.json();
            logger.debug('Direct Spotify profile check:', {
              id: profileData.id,
              name: profileData.display_name
            });
            
            // Then get the playlists
            const playlistsResponse = await fetch(`https://api.spotify.com/v1/users/${profileData.id}/playlists?limit=50`, {
              headers: {
                'Authorization': `Bearer ${session.user.spotifyAccessToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            });
            
            if (!playlistsResponse.ok) {
              console.error('Direct Spotify playlists API error:', playlistsResponse.status);
              throw new Error(`Failed to get Spotify playlists: ${playlistsResponse.statusText}`);
            }
            
            const playlistsData = await playlistsResponse.json();
            logger.debug('Direct Spotify playlists check:', {
              count: playlistsData.items?.length || 0,
              firstPlaylist: playlistsData.items?.[0] ? {
                id: playlistsData.items[0].id,
                name: playlistsData.items[0].name
              } : 'No playlists'
            });
            
            // If we found playlists, use them instead
            if (playlistsData.items?.length > 0) {
              logger.info(`Found ${playlistsData.items.length} playlists directly from Spotify API!`);
              
              // Format the playlists to match our expected format
              data.playlists = playlistsData.items.map((playlist: any) => ({
                ...playlist,
                platform: 'spotify'
              }));
            }
          } catch (directApiError) {
            console.error('Error in direct Spotify API call:', directApiError);
            // Continue with empty playlists from backend
          }
        }
      }
      
      if (response.ok && data.success) {
        logger.debug('Successfully received Spotify playlists data from API:', {
          receivedCount: data.playlists?.length || 0
        });

        // Ensure each playlist has the required platform field
        const enhancedPlaylists = (data.playlists || []).map((playlist: any) => ({
          ...playlist,
          platform: 'spotify' // Ensure platform field is present
        }));
        
        // Double check that playlists have the expected format before setting them
        const validPlaylists = enhancedPlaylists.filter(
          (playlist: any): playlist is SpotifyPlaylistItem => 
            !!playlist && 
            typeof playlist.id === 'string' && 
            typeof playlist.name === 'string'
        );

        if (validPlaylists.length !== data.playlists?.length) {
          console.warn(`Found ${validPlaylists.length} valid playlists out of ${data.playlists?.length || 0} total. Some may be malformed.`);
        }
        
        // Log the playlists we're about to set in state
        logger.debug('Setting Spotify playlists in state:', {
          count: validPlaylists.length,
          firstPlaylist: validPlaylists[0] ? {
            id: validPlaylists[0].id,
            name: validPlaylists[0].name,
            tracksTotal: validPlaylists[0].tracks?.total,
            platform: validPlaylists[0].platform
          } : 'No valid playlists'
        });
        
        // Update state in a more direct way
        setPlaylists(prev => {
          const newState = {
            ...prev,
            spotify: validPlaylists
          };
          logger.debug('New playlists state:', {
            spotifyCount: newState.spotify.length,
            youtubeCount: newState.youtube.length
          });
          return newState;
        });
        
        if (validPlaylists.length === 0) {
          logger.warn('No Spotify playlists found or all were invalid format');
        }
      } else {
        const errorMessage = data.error || 'Failed to fetch Spotify playlists';
        console.error('Spotify playlists API error:', errorMessage);
        
        // Specific error handling based on the error message
        if (errorMessage.includes('No Spotify access token available') || 
            errorMessage.includes('access token expired')) {
          if (setLoading) {
            setError('Your Spotify connection needs to be refreshed. Please try reconnecting.');
          }
          
          // Reset the connection state for Spotify but preserve other connections
          setConnections(prev => ({
            ...prev,
            spotify: false
          }));
        } else if (errorMessage.includes('Spotify account not connected')) {
          if (setLoading) {
            setError('Your Spotify account is not connected. Please connect it first.');
          }
          
          // Reset the connection state for Spotify but preserve other connections
          setConnections(prev => ({
            ...prev,
            spotify: false
          }));
        } else if (setLoading) {
          setError(`Error fetching Spotify playlists: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      // Check if this is a database connection error
      if (err instanceof Error && (
          err.message.includes('MongoServerSelectionError') || 
          err.message.includes('SSL routines'))) {
        console.warn('Database connection error in fetchSpotifyPlaylists:', err);
        // For database connection errors, we'll continue with empty playlists but not reset the connection
        if (setLoading) {
          setError(handleDatabaseError(err));
        }
      } else {
        console.error('Error in fetchSpotifyPlaylists:', err);
        if (setLoading && !error) { // Only set a generic error if we haven't set a specific one
          setError('Error fetching Spotify playlists. Please try again.');
        }
        
        // Clear playlists to avoid showing stale data
        setPlaylists(prev => ({
          ...prev,
          spotify: []
        }));
      }
    } finally {
      if (setLoading) {
        setIsImporting(false);
      }
    }
  }, [error, session, status]);
  
  /**
   * Checks platform connections for the user
   */
  const checkConnections = useCallback(async () => {
    setIsCheckingConnection(true);
    setError('');
    
    try {
      // Add timestamps to prevent caching
      const timestamp = Date.now();
      
      // Make parallel requests to check connections
      const [youtubeResponse, spotifyResponse] = await Promise.allSettled([
        fetch(`/api/connect/youtube?t=${timestamp}`).then(res => res.json()),
        fetch(`/api/connect/spotify?t=${timestamp}`).then(res => res.json())
      ]);
      
      // Initialize with default values in case of errors
      let youtubeData = { connected: false };
      let spotifyData = { connected: false };
      
      // Process YouTube response
      if (youtubeResponse.status === 'fulfilled') {
        youtubeData = youtubeResponse.value;
      } else {
        logger.error('Error checking YouTube Music connection:', youtubeResponse.reason);
      }
      
      // Process Spotify response
      if (spotifyResponse.status === 'fulfilled') {
        spotifyData = spotifyResponse.value;
      } else {
        logger.error('Error checking Spotify connection:', spotifyResponse.reason);
      }
      
      logger.debug('Connection check responses:', { 
        youtube: youtubeData, 
        spotify: spotifyData 
      });
      
      // Update connections state
      const newConnections = {
        youtube: youtubeData.connected,
        spotify: spotifyData.connected
      };
      
      setConnections(newConnections);
      
      // Create an array of promises for fetching playlists
      const fetchPromises = [];
      
      // If connected to YouTube, add YouTube fetch promise
      if (youtubeData.connected) {
        fetchPromises.push(
          fetchYoutubePlaylists(false)
            .catch(err => {
              logger.error('Error fetching YouTube playlists during connection check:', err);
              return null; // Continue even if one platform fetch fails
            })
        );
      }
      
      // If connected to Spotify, add Spotify fetch promise
      if (spotifyData.connected) {
        fetchPromises.push(
          fetchSpotifyPlaylists(false)
            .catch(err => {
              logger.error('Error fetching Spotify playlists during connection check:', err);
              return null; // Continue even if one platform fetch fails
            })
        );
      }
      
      // If there are any fetch promises, set loading state and execute them
      if (fetchPromises.length > 0) {
        setIsImporting(true);
        await Promise.allSettled(fetchPromises);
        setIsImporting(false);
      }
      
    } catch (err) {
      console.error('Error checking connections:', err);
      
      // Special handling for database connection errors
      if (err instanceof Error && (
          err.message.includes('MongoServerSelectionError') || 
          err.message.includes('SSL routines'))) {
        setError(handleDatabaseError(err));
        
        // Use cached information if available, otherwise assume disconnected
        console.warn('Database error during connection check. Using cached connection state.');
      } else {
        setError('Error checking platform connections. Please try again.');
      }
    } finally {
      setIsCheckingConnection(false);
    }
  }, [fetchSpotifyPlaylists, fetchYoutubePlaylists]);
  
  /**
   * Effect to check connections when session changes
   */
  useEffect(() => {
    if (status === 'authenticated') {
      checkConnections().catch(err => {
        console.error('Error in initial connection check:', err);
        // Silently fail initial connection check to not block UI
      });
    }
  }, [status, checkConnections]);
  
  // Return the hook values
  return {
    connections,
    isCheckingConnection,
    playlists,
    isImporting,
    error,
    message,
    setError,
    setMessage,
    setConnections,
    setPlaylists,
    checkConnections,
    fetchSpotifyPlaylists,
    fetchYoutubePlaylists
  };
} 