'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { usePlatformConnections } from '@/hooks/usePlatformConnections';
import logger from '@/lib/logger';

// Add type import from the hook
import type { PlatformConnections } from '@/hooks/usePlatformConnections';

/**
 * Button component for importing playlists from connected platforms
 * 
 * @returns The import playlists button component
 */
export default function ImportPlaylistsButton() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({
    spotify: false,
    youtube: false
  });
  const [importStatus, setImportStatus] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'spotify' | 'youtube'>('youtube');
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Add state for token validation
  const [tokenValidation, setTokenValidation] = useState({
    spotifyValid: false,
    youtubeValid: false
  });
  
  // Use the platform connections hook
  const { 
    connections, 
    isCheckingConnection, 
    playlists, 
    isImporting, 
    error, 
    message, 
    setError,
    setMessage,
    checkConnections,
    fetchSpotifyPlaylists,
    fetchYoutubePlaylists,
    setConnections,
    setPlaylists
  } = usePlatformConnections();
  
  // Consolidated logging effect that combines all debug info
  // and only logs when something important changes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Create a debug object with all relevant state
      const debugState = {
        // Connection status
        connections: {
          spotify: connections.spotify,
          youtube: connections.youtube,
        },
        // Playlist counts
        playlists: {
          spotifyCount: playlists.spotify.length,
          youtubeCount: playlists.youtube.length,
        },
        // UI state
        ui: {
          activeTab,
          isModalOpen,
          isInitializing,
          isCheckingConnection,
        },
        // Timestamp for tracking when events happen
        timestamp: new Date().toISOString()
      };
      
      // Only log debug information in development environment
      logger.debug('ImportPlaylistsButton - State updated', debugState);
    }
  }, [
    // Only trigger this effect when important state changes
    connections.spotify, 
    connections.youtube,
    playlists.spotify.length,
    playlists.youtube.length,
    activeTab,
    isModalOpen,
    isInitializing,
    isCheckingConnection
  ]);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  /**
   * Effect to track state changes for debugging (only in development)
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // Create a debug object with all relevant state
      const debugState = {
        // Connection status
        connections: {
          spotify: connections.spotify,
          youtube: connections.youtube,
        },
        // Playlist counts
        playlists: {
          spotifyCount: playlists.spotify.length,
          youtubeCount: playlists.youtube.length,
        },
        // UI state
        ui: {
          activeTab,
          isModalOpen,
          isInitializing,
          isCheckingConnection,
        },
        // Timestamp for tracking when events happen
        timestamp: new Date().toISOString()
      };
      
      // Only log debug information in development environment
      logger.debug('ImportPlaylistsButton - State updated', debugState);
    }
  }, [
    // Only trigger this effect when important state changes
    connections.spotify, 
    connections.youtube,
    playlists.spotify.length,
    playlists.youtube.length,
    activeTab,
    isModalOpen,
    isInitializing,
    isCheckingConnection
  ]);
  
  /**
   * Effect to check connections when modal opens
   */
  useEffect(() => {
    logger.debug('Modal state effect triggered:', {
      isModalOpen,
      status,
      sessionExists: !!session,
      timestamp: new Date().toISOString()
    });
    
    let safetyTimeout: NodeJS.Timeout | null = null;
    
    if (isModalOpen && status === 'authenticated') {
      // Initialize with loading state
      logger.debug('Starting initialization and connection check process');
      setIsInitializing(true);
      
      // Add a safety timeout to clear initialization state after 5 seconds maximum
      // This prevents the UI from getting stuck in loading state indefinitely
      safetyTimeout = setTimeout(() => {
        logger.warn("Safety timeout triggered - forcing initialization to complete");
        if (isMounted.current) {
          setIsInitializing(false);
          setError("Connection check timed out. You may need to manually refresh or reconnect your accounts.");
        }
      }, 5000);
      
      // Perform a complete check before updating the UI
      const checkAllConnections = async () => {
        try {
          // First check if tokens exist in session
          const hasSpotifyToken = !!session?.user?.spotifyAccessToken;
          const hasGoogleToken = !!session?.user?.googleAccessToken;
          
          console.log('Starting connection check with tokens:', {
            hasSpotifyToken,
            hasGoogleToken
          });
          
          // Validate tokens if they exist (run in parallel for speed)
          const validationPromises = [];
          
          if (hasSpotifyToken) {
            validationPromises.push(
              fetch('/api/auth/validate-token?provider=spotify', {
                headers: { 'Cache-Control': 'no-cache' }
              })
              .then(res => res.json())
              .then(data => {
                setTokenValidation(prev => ({ ...prev, spotifyValid: data.valid }));
                console.log('Spotify token validation:', { valid: data.valid });
                if (!data.valid) {
                  console.warn('Spotify token invalid:', data);
                }
                return { provider: 'spotify', valid: data.valid };
              })
              .catch(err => {
                console.error('Error validating Spotify token:', err);
                return { provider: 'spotify', valid: false, error: err };
              })
            );
          }
          
          if (hasGoogleToken) {
            validationPromises.push(
              fetch('/api/auth/validate-token?provider=google', {
                headers: { 'Cache-Control': 'no-cache' }
              })
              .then(res => res.json())
              .then(data => {
                setTokenValidation(prev => ({ ...prev, youtubeValid: data.valid }));
                console.log('YouTube token validation:', { valid: data.valid });
                if (!data.valid) {
                  console.warn('YouTube token invalid:', data);
                  if (data.reason === 'permission_error') {
                    setError('Your YouTube connection has insufficient permissions. Please reconnect with the required YouTube permissions.');
                  }
                }
                return { provider: 'google', valid: data.valid };
              })
              .catch(err => {
                console.error('Error validating Google token:', err);
                return { provider: 'google', valid: false, error: err };
              })
            );
          }
          
          try {
            // Wait for all validation promises to complete with a timeout
            const validationTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Validation timed out')), 8000)
            );
            
            await Promise.race([
              Promise.all(validationPromises),
              validationTimeout
            ]);
          } catch (validationError) {
            console.error('Validation timeout or error:', validationError);
            // Continue with what we have, don't block the UI
          }
          
          // Prepare the final state
          const finalConnections = {
            spotify: tokenValidation.spotifyValid,
            youtube: tokenValidation.youtubeValid
          };
          
          // Set active tab to the first valid connection
          if (tokenValidation.youtubeValid) {
            setActiveTab('youtube');
          } else if (tokenValidation.spotifyValid) {
            setActiveTab('spotify');
          }
          
          // Update connections after checking
          setConnections(finalConnections);
          
          // Always ensure we exit initialization state even if playlist fetch fails
          setIsInitializing(false);
          
          // Fetch playlists for any connected platforms (in the background)
          if (tokenValidation.spotifyValid) {
            fetchSpotifyPlaylists(false).catch(err => {
              logger.error('Error fetching Spotify playlists during initialization:', err);
              // Check for database connection errors
              if (err.message && (
                  err.message.includes('database') || 
                  err.message.includes('MongoDB') ||
                  err.message.includes('SSL routines'))) {
                setError('Database connection issues detected. Some features may be limited, but you can still browse your connected accounts.');
              }
            });
          } 
          
          if (tokenValidation.youtubeValid) {
            fetchYoutubePlaylists(false).catch(err => {
              logger.error('Error fetching YouTube playlists during initialization:', err);
              // Check for database connection errors
              if (err.message && (
                  err.message.includes('database') || 
                  err.message.includes('MongoDB') ||
                  err.message.includes('SSL routines'))) {
                setError('Database connection issues detected. Some features may be limited, but you can still browse your connected accounts.');
              }
            });
          }
          
        } catch (err: any) {
          console.error('Error checking connections:', err);
          // Check if this is a database error
          if (err.message && (
              err.message.includes('database') || 
              err.message.includes('MongoDB') ||
              err.message.includes('SSL routines'))) {
            setError('Database connection issues detected. Some features may be limited, but you can still browse your connected accounts.');
          } else {
            setError('Error checking platform connections. Please try again.');
          }
          // Ensure we exit initialization state even on error
          setIsInitializing(false);
        } finally {
          // Clear the safety timeout since we're done
          if (safetyTimeout) {
            clearTimeout(safetyTimeout);
          }
        }
      };
      
      checkAllConnections().catch(err => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error in connection check effect:', err);
        }
      });
    } else if (!isModalOpen) {
      // Reset state when modal is closed
      setError('');
      setMessage('');
      setIsInitializing(false); // Ensure we clear initialization state when modal closes
    }
  }, [isModalOpen, status, session, setConnections, setError, fetchSpotifyPlaylists, fetchYoutubePlaylists, setActiveTab]);
  
  /**
   * Validates token expiration and status
   * Note: This is now handled together with checkConnections
   */
  const validateTokens = async () => {
    // Validation logic is now integrated with checkAllConnections
  };
  
  /**
   * Handles fetching playlists for the active tab
   */
  const fetchPlaylistsForActiveTab = async () => {
    try {
      setError('');
      setMessage('');
      
      console.log(`About to fetch ${activeTab} playlists...`);
      
      if (activeTab === 'youtube') {
        await fetchYoutubePlaylists();
      } else {
        await fetchSpotifyPlaylists();
      }
      
      // Check what we have after fetch
      console.log(`After fetching ${activeTab} playlists:`, {
        count: playlists[activeTab].length,
        firstItem: playlists[activeTab][0] || 'No playlists found'
      });
    } catch (err) {
      console.error(`Error fetching ${activeTab} playlists:`, err);
    }
  };
  
  /**
   * Effect to fetch playlists when active tab changes
   */
  useEffect(() => {
    if (isModalOpen && connections[activeTab]) {
      fetchPlaylistsForActiveTab();
    }
  }, [activeTab, isModalOpen, connections]);
  
  /**
   * Manually retries loading playlists for the current platform with cache-busting measures
   */
  const retryLoadingPlaylists = () => {
    console.log(`Forcefully retrying loading ${activeTab} playlists with cache busting...`);
    setError('');
    setMessage(`Refreshing ${activeTab} playlists...`);
    
    // Delay briefly to ensure any prev. request completes
    setTimeout(() => {
      if (activeTab === 'youtube') {
        fetchYoutubePlaylists();
      } else {
        fetchSpotifyPlaylists();
      }
    }, 500);
  };
  
  /**
   * Force refreshes all platform connections and data
   */
  const forceRefreshAllConnections = () => {
    console.log("Force refreshing all platform connections and data");
    setError(''); // Clear any previous errors
    setMessage('Refreshing all platform connections...');
    
    // First clear the playlist data to avoid showing stale data
    setPlaylists({
      spotify: [],
      youtube: []
    });
    
    // Then check connections again which will trigger playlist fetches
    checkConnections();
  };
  
  /**
   * Opens the modal and triggers connection checking
   */
  const openModal = () => {
    setIsModalOpen(true);
    
    // Reset errors when opening the modal
    setError('');
    setMessage('');
    
    // Don't automatically fetch playlists here - let the connection check handle it
    // This prevents duplicate API calls
  };
  
  /**
   * Closes the import modal and resets all relevant state
   */
  const closeModal = () => {
    setIsModalOpen(false);
    setIsInitializing(false);
    setError('');
    setMessage('');
  };
  
  /**
   * Connects to YouTube Music
   */
  const connectToYoutube = () => {
    try {
      setIsConnecting(prev => ({ ...prev, youtube: true }));
      setError(''); // Clear any previous errors
      setMessage('Connecting to YouTube...');
      
      // Add a timestamp to prevent caching issues
      const timestamp = Date.now();
      
      // Use a more specific callback URL with a special parameter to indicate we're connecting YouTube
      const callbackUrl = `${window.location.origin}/playlists?connect=youtube&t=${timestamp}`;
      console.log('Connecting to YouTube with callback:', callbackUrl);
      
      // Store the callback URL in localStorage so we can check it when we return
      localStorage.setItem('youtubeConnectCallback', callbackUrl);
      
      // Force a clean login to ensure proper token acquisition
      localStorage.setItem('youtubeConnecting', 'true');
      
      // Use all required scopes for YouTube access
      signIn('google', { 
        callbackUrl,
        // Include all necessary scopes for YouTube functionality
        scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl openid profile email'
      }).catch(err => {
        console.error('Error during Google sign-in:', err);
        setIsConnecting(prev => ({ ...prev, youtube: false }));
        setError(`Failed to connect to YouTube: ${err.message || 'Unknown error'}`);
        setMessage('');
      });
    } catch (err) {
      console.error('Error initiating YouTube connection:', err);
      setIsConnecting(prev => ({ ...prev, youtube: false }));
      setError('Failed to connect to YouTube. Please try again.');
      setMessage('');
    }
  };
  
  /**
   * Fixes YouTube connection issues by prompting reconnection
   */
  const fixYoutubeConnection = () => {
    try {
      setError('');
      setMessage('Reconnecting to YouTube...');
      console.log('Attempting to fix YouTube connection...');
      
      // Set a flag in localStorage to indicate we're trying to reconnect
      localStorage.setItem('youtubeReconnecting', 'true');
      
      // Connect to YouTube again with all required scopes
      signIn('google', { 
        callbackUrl: `${window.location.origin}/playlists?connect=youtube&t=${Date.now()}`,
        // Include all required scopes
        scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl openid profile email'
      }).catch(err => {
        console.error('Error during Google reconnect:', err);
        setError(`Failed to reconnect to YouTube: ${err.message || 'Unknown error'}`);
        setMessage('');
      });
    } catch (err) {
      console.error('Error attempting to fix YouTube connection:', err);
      setError('Failed to reconnect YouTube. Please try again.');
      setMessage('');
    }
  };
  
  /**
   * Connects the user to Spotify
   */
  const connectToSpotify = () => {
    setIsConnecting(prev => ({ ...prev, spotify: true }));
    setError('');
    setMessage('Redirecting to Spotify authorization...');
    
    // Add a small delay to show the loading state
    setTimeout(() => {
      signIn('spotify', { 
        callbackUrl: `${window.location.origin}/playlists?spotify=connected`
      });
    }, 500);
  };
  
  /**
   * Attempts to fix the Spotify connection by reconnecting
   */
  const fixSpotifyConnection = () => {
    setMessage('Attempting to reconnect Spotify...');
    setError('');
    
    // Check if we already have a token
    if (session?.user?.spotifyAccessToken) {
      // Try to validate the token first
      fetch('/api/auth/validate-token?provider=spotify')
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setMessage('Your Spotify token is valid. Refreshing playlists...');
            fetchSpotifyPlaylists();
          } else {
            setMessage('Your Spotify token is invalid. Redirecting to reconnect...');
            // Add slight delay to show message
            setTimeout(() => connectToSpotify(), 1000);
          }
        })
        .catch(err => {
          console.error('Error validating Spotify token:', err);
          setError('Error checking Spotify connection. Try reconnecting.');
          // Add slight delay before redirecting
          setTimeout(() => connectToSpotify(), 1000);
        });
    } else {
      // No token, need to connect
      connectToSpotify();
    }
  };
  
  /**
   * Refreshes platform connections and fetches playlists again
   * This can be used when there's an error connecting to platforms
   */
  const refreshConnections = () => {
    setError('');
    setMessage('Refreshing connections...');
    console.log('Refreshing platform connections...');
    
    // Check if we have specific issues with Spotify
    if (connections.spotify && !session?.user?.spotifyAccessToken) {
      fixSpotifyConnection();
      return;
    }
    
    // Check if we have specific issues with YouTube
    if (connections.youtube && !session?.user?.googleAccessToken) {
      fixYoutubeConnection();
      return;
    }
    
    checkConnections();
  };
  
  /**
   * Effect to check if we've just returned from OAuth authentication
   */
  useEffect(() => {
    const checkAuth = async () => {
      // Check if we have stored callback URLs
      const youtubeCallback = localStorage.getItem('youtubeConnectCallback');
      const spotifyCallback = localStorage.getItem('spotifyConnectCallback');
      const spotifyReconnecting = localStorage.getItem('spotifyReconnecting');
      const youtubeReconnecting = localStorage.getItem('youtubeReconnecting');
      const youtubeConnecting = localStorage.getItem('youtubeConnecting');
      
      if (!youtubeCallback && !spotifyCallback && !spotifyReconnecting && !youtubeReconnecting && !youtubeConnecting) return;
      
      // Check if the current URL contains the connect parameter
      const urlParams = new URLSearchParams(window.location.search);
      const connectParam = urlParams.get('connect');
      
      let needsRefresh = false;
      
      // Check if we were trying to reconnect to YouTube
      if ((youtubeReconnecting === 'true' || youtubeConnecting === 'true') && session?.user?.googleAccessToken) {
        console.log('Detected return from YouTube reconnection...');
        
        try {
          // Get the YouTube user ID from the profile API
          const profileResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
            headers: {
              Authorization: `Bearer ${session.user.googleAccessToken}`
            }
          });
          
          if (!profileResponse.ok) {
            throw new Error('Failed to fetch YouTube profile after reconnection');
          }
          
          const profileData = await profileResponse.json();
          const youtubeUserId = profileData.items?.[0]?.id;
          
          if (!youtubeUserId) {
            throw new Error('YouTube user ID not found in profile after reconnection');
          }
          
          // Call our direct connection endpoint to store the connection
          const connectResponse = await fetch('/api/connect/youtube', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ youtubeUserId })
          });
          
          const connectData = await connectResponse.json();
          
          if (!connectResponse.ok) {
            throw new Error(connectData.message || 'Failed to connect YouTube');
          }
          
          console.log('YouTube reconnection completed:', connectData);
          setMessage('YouTube reconnected successfully!');
          
          // Clear the reconnection flags
          localStorage.removeItem('youtubeReconnecting');
          localStorage.removeItem('youtubeConnecting');
          
          // Ensure we clear the initializing state
          setIsInitializing(false);
          
          // Keep track that we need to refresh connections
          needsRefresh = true;
        } catch (error) {
          console.error('Error completing YouTube reconnection:', error);
          setError('Failed to reconnect YouTube. Please try again.');
        }
      }
      // Check if we were trying to reconnect to Spotify
      else if (spotifyReconnecting === 'true' && session?.user?.spotifyAccessToken) {
        console.log('Detected return from Spotify reconnection...');
        
        try {
          // Get the Spotify user ID from the profile API
          const profileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              Authorization: `Bearer ${session.user.spotifyAccessToken}`
            }
          });
          
          if (!profileResponse.ok) {
            throw new Error('Failed to fetch Spotify profile after reconnection');
          }
          
          const profileData = await profileResponse.json();
          const spotifyUserId = profileData.id;
          
          if (!spotifyUserId) {
            throw new Error('Spotify user ID not found in profile after reconnection');
          }
          
          // Call our direct connection endpoint to store the connection
          const connectResponse = await fetch('/api/connect/spotify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ spotifyUserId })
          });
          
          const connectData = await connectResponse.json();
          
          if (!connectResponse.ok) {
            throw new Error(connectData.message || 'Failed to connect Spotify');
          }
          
          console.log('Spotify reconnection completed:', connectData);
          setMessage('Spotify reconnected successfully!');
          
          // Clear the reconnection flag
          localStorage.removeItem('spotifyReconnecting');
          
          // Ensure we clear the initializing state
          setIsInitializing(false);
          
          // Keep track that we need to refresh connections
          needsRefresh = true;
        } catch (error) {
          console.error('Error completing Spotify reconnection:', error);
          setError('Failed to reconnect Spotify. Please try again.');
        }
      }
      // Handle regular YouTube connection callback
      else if (connectParam === 'youtube' && youtubeCallback && session?.user?.googleAccessToken) {
        console.log('Detected return from Google auth, completing connection...');
        
        try {
          // Get the YouTube user ID from the profile API
          const profileResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
            headers: {
              Authorization: `Bearer ${session.user.googleAccessToken}`
            }
          });
          
          if (!profileResponse.ok) {
            throw new Error('Failed to fetch YouTube profile');
          }
          
          const profileData = await profileResponse.json();
          const youtubeUserId = profileData.items?.[0]?.id;
          
          if (!youtubeUserId) {
            throw new Error('YouTube user ID not found in profile');
          }
          
          // Call our direct connection endpoint to store the connection
          const connectResponse = await fetch('/api/connect/youtube', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ youtubeUserId })
          });
          
          const connectData = await connectResponse.json();
          
          if (!connectResponse.ok) {
            throw new Error(connectData.message || 'Failed to connect YouTube');
          }
          
          console.log('YouTube connection completed:', connectData);
          setMessage('YouTube connected successfully!');
          
          // Clear the stored callback URL
          localStorage.removeItem('youtubeConnectCallback');
          
          // Ensure we clear the initializing state
          setIsInitializing(false);
          
          // Remove the connect parameter from the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('connect');
          newUrl.searchParams.delete('t');
          window.history.replaceState({}, '', newUrl);
          
          // Keep track that we need to refresh connections
          needsRefresh = true;
        } catch (error) {
          console.error('Error completing YouTube connection:', error);
          setError('Failed to connect YouTube. Please try again.');
        }
      } 
      // Handle regular Spotify connection callback
      else if (connectParam === 'spotify' && spotifyCallback && session?.user?.spotifyAccessToken) {
        console.log('Detected return from Spotify auth, completing connection...');
        
        try {
          // Get the Spotify user ID from the profile API
          const profileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              Authorization: `Bearer ${session.user.spotifyAccessToken}`
            }
          });
          
          if (!profileResponse.ok) {
            throw new Error('Failed to fetch Spotify profile');
          }
          
          const profileData = await profileResponse.json();
          const spotifyUserId = profileData.id;
          
          if (!spotifyUserId) {
            throw new Error('Spotify user ID not found in profile');
          }
          
          // Call our direct connection endpoint to store the connection
          const connectResponse = await fetch('/api/connect/spotify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ spotifyUserId })
          });
          
          const connectData = await connectResponse.json();
          
          if (!connectResponse.ok) {
            throw new Error(connectData.message || 'Failed to connect Spotify');
          }
          
          console.log('Spotify connection completed:', connectData);
          setMessage('Spotify connected successfully!');
          
          // Clear the stored callback URL
          localStorage.removeItem('spotifyConnectCallback');
          
          // Ensure we clear the initializing state
          setIsInitializing(false);
          
          // Remove the connect parameter from the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('connect');
          newUrl.searchParams.delete('t');
          window.history.replaceState({}, '', newUrl);
          
          // Keep track that we need to refresh connections
          needsRefresh = true;
        } catch (error) {
          console.error('Error completing Spotify connection:', error);
          setError('Failed to connect Spotify. Please try again.');
        }
      }
      
      // If modal is open and we connected successfully, refresh both connections
      if (needsRefresh && isModalOpen) {
        // Ensure initialization state is cleared
        setIsInitializing(false);
        
        // Add a small delay to ensure all database updates are complete
        setTimeout(() => {
          checkConnections();
        }, 1000);
      } else if (needsRefresh) {
        // Ensure initialization state is cleared even when refreshing the page
        setIsInitializing(false);
        
        // Just refresh the page if modal isn't open
        router.refresh();
      }
    };
    
    if (status === 'authenticated' && (session?.user?.googleAccessToken || session?.user?.spotifyAccessToken)) {
      checkAuth();
    }
  }, [session, status, router, isModalOpen, checkConnections]);

  /**
   * Imports a playlist from the active platform
   * 
   * @param playlistId - The playlist ID to import
   */
  const importPlaylist = async (playlistId: string) => {
    setImportStatus(prev => ({ ...prev, [playlistId]: 'importing' }));
    setError('');
    setMessage('');
    
    try {
      const endpoint = activeTab === 'youtube' ? '/api/import/youtube' : '/api/import/spotify';
      const body = activeTab === 'youtube' 
        ? { youtubePlaylistId: playlistId } 
        : { spotifyPlaylistId: playlistId };
      
      console.log(`Importing ${activeTab} playlist ${playlistId}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      // Log the import response for debugging
      console.log(`${activeTab} import response:`, data);
      
      if (response.ok && data.success) {
        setImportStatus(prev => ({ ...prev, [playlistId]: 'success' }));
        
        // Set success message with details
        const trackCount = data.trackCount || 0;
        const successMessage = data.message || `Successfully imported ${activeTab} playlist with ${trackCount} tracks`;
        setMessage(successMessage);
        
        // Add a delay before redirecting to allow the user to see the success state
        setTimeout(() => {
          // Close the modal and refresh the page to show the newly imported playlist
          closeModal();
          router.refresh();
        }, 2000);
      } else {
        // Handle known error cases
        if (data.needsReconnect) {
          setError(`Your ${activeTab} connection needs to be refreshed. Please reconnect.`);
          // Reset the connection for this platform
          setConnections((prev: PlatformConnections) => ({
            ...prev,
            [activeTab]: false
          }));
        } else {
          throw new Error(data.error || `Failed to import ${activeTab} playlist`);
        }
        
        setImportStatus(prev => ({ ...prev, [playlistId]: 'error' }));
      }
    } catch (error) {
      console.error(`Error importing ${activeTab} playlist:`, error);
      setImportStatus(prev => ({ ...prev, [playlistId]: 'error' }));
      setError(error instanceof Error ? error.message : `Failed to import ${activeTab} playlist`);
    }
  };
  
  /**
   * Handles completion of the import process
   */
  const handleDone = () => {
    closeModal();
    router.refresh();
  };
  
  /**
   * Renders the connection button for a platform
   * 
   * @param platform - The platform to connect to ('youtube' or 'spotify')
   * @returns The connection button component
   */
  const renderConnectionButton = (platform: 'youtube' | 'spotify') => {
    const isPlatformConnecting = platform === 'youtube' 
      ? isConnecting.youtube 
      : isConnecting.spotify;
    
    return (
      <button
        onClick={platform === 'youtube' ? connectToYoutube : connectToSpotify}
        disabled={isPlatformConnecting || isCheckingConnection}
        className={`w-full mt-3 flex items-center justify-center ${
          platform === 'youtube' 
            ? 'bg-red-700 hover:bg-red-600 shadow-[0_0_10px_#ff0000] crt-glow-youtube text-white' 
            : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[0_0_10px_#1DB954] crt-glow-spotify'
        } font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 font-vt323`}
      >
        {platform === 'youtube' ? (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        )}
        {isPlatformConnecting 
          ? 'Connecting...' 
          : `Connect to ${platform === 'youtube' ? 'YouTube Music' : 'Spotify'}`}
      </button>
    );
  };
  
  /**
   * Directly tests the Spotify API connection for debugging purposes
   */
  const testSpotifyAPI = async () => {
    setError('');
    setMessage('Testing Spotify API directly...');
    
    try {
      if (!session?.user?.spotifyAccessToken) {
        setError('No Spotify access token available');
        return;
      }
      
      console.log('Testing Spotify API with direct fetch...');
      
      // Try to get the user profile first
      const profileResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${session.user.spotifyAccessToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      
      if (!profileResponse.ok) {
        setError(`Spotify profile API error: ${profileResponse.status}`);
        return;
      }
      
      const profileData = await profileResponse.json();
      console.log('Spotify profile test:', profileData);
      
      // Then try to get the playlists directly
      const playlistsResponse = await fetch(`https://api.spotify.com/v1/users/${profileData.id}/playlists?limit=50`, {
        headers: {
          'Authorization': `Bearer ${session.user.spotifyAccessToken}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      
      if (!playlistsResponse.ok) {
        setError(`Spotify playlists API error: ${playlistsResponse.status}`);
        return;
      }
      
      const playlistsData = await playlistsResponse.json();
      console.log('Spotify playlists test:', {
        total: playlistsData.total,
        count: playlistsData.items?.length || 0,
        firstPlaylist: playlistsData.items?.[0] ? {
          id: playlistsData.items[0].id,
          name: playlistsData.items[0].name,
          tracks: playlistsData.items[0].tracks?.total
        } : 'No playlists'
      });
      
      setMessage(`Direct API test: Found ${playlistsData.items?.length || 0} Spotify playlists for user ${profileData.display_name}`);
    } catch (error) {
      console.error('Error testing Spotify API:', error);
      setError(`Direct API test error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Add a manual reset function for users to use if the initialization gets stuck
  const resetInitializationState = () => {
    setIsInitializing(false);
    // We can't directly set isCheckingConnection as there's no setter exposed from the hook
    // Instead, let's trigger a direct call to checkConnections which will update the state
    // and then immediately proceed to the next step
    setTimeout(() => {
      // This will force the process to complete
      checkConnections().catch(err => {
        console.error("Error during manual connection check:", err);
      });
    }, 100);
  };
  
  return (
    <>
      <button
        onClick={openModal}
        className="bg-green-800 hover:bg-green-700 text-white font-vt323 px-4 py-2 rounded-md transition-colors shadow-[0_0_10px_#00ff00] crt-glow"
      >
        IMPORT PLAYLISTS
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-black border-2 border-green-500 rounded-lg shadow-[0_0_15px_#00ff00] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col crt-panel">
            <div className="flex justify-between items-center p-4 border-b border-green-700">
              <h2 className="text-2xl font-bold text-green-500 font-vt323 crt-text tracking-wider">IMPORT PLAYLISTS</h2>
              <button 
                onClick={closeModal}
                className="text-green-500 hover:text-green-400 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            
            {error && (
              <div className="bg-red-900/30 text-red-500 p-3 mb-3 border border-red-700 mx-4 mt-4 font-vt323 crt-text">
                {error}
              </div>
            )}
            
            {message && (
              <div className="bg-green-900/30 text-green-300 p-3 mb-3 border border-green-700 mx-4 mt-4 font-vt323 crt-text">
                {message}
              </div>
            )}
            
            {isInitializing && (
              <div className="p-8 text-center font-vt323 text-green-500">
                <div className="animate-pulse crt-text text-xl mb-4">Initializing...</div>
                <div className="flex justify-center my-4">
                  <div className="animate-spin h-10 w-10 border-4 border-green-500 rounded-full border-t-transparent"></div>
                </div>
                <div className="crt-text">Checking platform connections...</div>
              </div>
            )}
            
            {!isInitializing && (
              <>
                {/* Debug info for development environment */}
                {process.env.NODE_ENV !== 'production' && (
                  <div className="bg-yellow-800/30 border border-yellow-700 m-4 p-3 font-mono text-xs text-yellow-400">
                    <div className="font-bold mb-2">DEBUG INFO:</div>
                    <div>isInitializing: {isInitializing ? 'true' : 'false'}</div>
                    <div>isCheckingConnection: {isCheckingConnection ? 'true' : 'false'}</div>
                    <div>hasSpotifyToken: {session?.user?.spotifyAccessToken ? 'true' : 'false'}</div>
                    <div>hasGoogleToken: {session?.user?.googleAccessToken ? 'true' : 'false'}</div>
                    <div>spotifyConnected: {connections.spotify ? 'true' : 'false'}</div>
                    <div>youtubeConnected: {connections.youtube ? 'true' : 'false'}</div>
                    <div>activeTab: {activeTab}</div>
                    <div>spotifyPlaylists: {playlists.spotify.length}</div>
                    <div>youtubePlaylists: {playlists.youtube.length}</div>
                    <button 
                      onClick={resetInitializationState}
                      className="bg-yellow-700 text-white px-2 py-1 rounded mt-2 text-xs"
                    >
                      Force Reset UI State
                    </button>
                  </div>
                )}
                
                {/* Platform Tabs */}
                <div className="flex border-b border-green-700">
                  <button
                    className={`py-2 px-4 font-vt323 text-lg ${
                      activeTab === 'youtube'
                        ? 'bg-red-900 text-white border-t-2 border-r-2 border-red-700'
                        : 'bg-black text-red-500 hover:bg-red-900/50'
                    }`}
                    onClick={() => setActiveTab('youtube')}
                  >
                    YouTube Music
                  </button>
                  <button
                    className={`py-2 px-4 font-vt323 text-lg ${
                      activeTab === 'spotify'
                        ? 'bg-green-900 text-white border-t-2 border-r-2 border-green-700'
                        : 'bg-black text-green-500 hover:bg-green-900/50'
                    }`}
                    onClick={() => setActiveTab('spotify')}
                  >
                    Spotify
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto">
                  {/* YouTube Content */}
                  {activeTab === 'youtube' && (
                    <>
                      <h3 className="font-vt323 text-xl text-green-500 mb-2">YOUTUBE MUSIC PLAYLISTS</h3>
                      
                      {!connections.youtube ? (
                        <div className="space-y-4">
                          <p className="font-vt323 text-green-400">Connect your YouTube account to import playlists.</p>
                          <button
                            onClick={connectToYoutube}
                            className="bg-red-700 hover:bg-red-600 text-white font-vt323 px-4 py-2 rounded-md transition-colors shadow-[0_0_5px_#ff0000] crt-glow-youtube"
                            disabled={isConnecting.youtube}
                          >
                            {isConnecting.youtube ? 'CONNECTING...' : 'CONNECT YOUTUBE'}
                          </button>
                        </div>
                      ) : isImporting ? (
                        <div className="p-4 text-center font-vt323">
                          <div className="animate-pulse">Loading playlists...</div>
                          <div className="flex justify-center my-4">
                            <div className="animate-spin h-8 w-8 border-4 border-red-500 rounded-full border-t-transparent"></div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {playlists.youtube.length > 0 ? (
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                              {playlists.youtube.map(playlist => (
                                <div 
                                  key={playlist.id}
                                  className="border border-red-800 p-3 rounded-md bg-black/50 flex justify-between items-center"
                                >
                                  <div className="flex items-center">
                                    {playlist.images && playlist.images[0] && (
                                      <img 
                                        src={playlist.images[0].url} 
                                        alt={playlist.name}
                                        className="w-12 h-12 object-cover mr-3 rounded"
                                      />
                                    )}
                                    <div>
                                      <h4 className="font-vt323 text-lg text-red-300">{playlist.name}</h4>
                                      <p className="font-vt323 text-sm text-red-500">
                                        {playlist.tracks?.total !== undefined ? `${playlist.tracks.total} tracks` : 'Unknown tracks'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {importStatus[playlist.id] === 'importing' ? (
                                    <span className="font-vt323 text-yellow-500 flex items-center">
                                      <span className="animate-spin h-4 w-4 border-2 border-yellow-500 rounded-full border-t-transparent mr-2"></span>
                                      IMPORTING...
                                    </span>
                                  ) : importStatus[playlist.id] === 'success' ? (
                                    <span className="font-vt323 text-green-500">IMPORTED ✓</span>
                                  ) : importStatus[playlist.id] === 'error' ? (
                                    <span className="font-vt323 text-red-500">FAILED ✗</span>
                                  ) : (
                                    <button
                                      onClick={() => importPlaylist(playlist.id)}
                                      className="bg-red-700 hover:bg-red-600 text-white font-vt323 px-3 py-1 rounded-md transition-colors shadow-[0_0_5px_#ff0000] crt-glow-youtube"
                                    >
                                      IMPORT
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-black/30 p-4 border border-gray-800 rounded-md text-center">
                              <p className="font-vt323 text-green-400 mb-2">No YouTube playlists found.</p>
                              <button
                                onClick={retryLoadingPlaylists}
                                className="bg-red-700 hover:bg-red-600 text-white font-vt323 px-3 py-1 rounded-md transition-colors shadow-[0_0_5px_#ff0000] mt-2"
                              >
                                RETRY
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Spotify Content */}
                  {activeTab === 'spotify' && (
                    <>
                      <h3 className="font-vt323 text-xl text-green-500 mb-2">SPOTIFY PLAYLISTS</h3>
                      
                      {!connections.spotify ? (
                        <div className="space-y-4 bg-black/30 p-6 border border-green-900 rounded-md">
                          <p className="font-vt323 text-green-400 text-center">Connect your Spotify account to import playlists.</p>
                          <div className="flex justify-center">
                            <button
                              onClick={connectToSpotify}
                              className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-vt323 px-4 py-2 rounded-md transition-colors shadow-[0_0_5px_#1DB954] crt-glow-spotify"
                              disabled={isConnecting.spotify}
                            >
                              {isConnecting.spotify ? 'CONNECTING...' : 'CONNECT SPOTIFY'}
                            </button>
                          </div>
                        </div>
                      ) : isImporting ? (
                        <div className="p-4 text-center font-vt323">
                          <div className="animate-pulse">Loading playlists...</div>
                          <div className="flex justify-center my-4">
                            <div className="animate-spin h-8 w-8 border-4 border-[#1DB954] rounded-full border-t-transparent"></div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {playlists.spotify.length > 0 ? (
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                              {playlists.spotify.map(playlist => (
                                <div 
                                  key={playlist.id}
                                  className="border border-green-800 p-3 rounded-md bg-black/50 flex justify-between items-center"
                                >
                                  <div className="flex items-center">
                                    {playlist.images && playlist.images[0] && (
                                      <img 
                                        src={playlist.images[0].url} 
                                        alt={playlist.name}
                                        className="w-12 h-12 object-cover mr-3 rounded"
                                      />
                                    )}
                                    <div>
                                      <h4 className="font-vt323 text-lg text-green-300">{playlist.name}</h4>
                                      <p className="font-vt323 text-sm text-green-500">
                                        {playlist.tracks?.total !== undefined ? `${playlist.tracks.total} tracks` : 'Unknown tracks'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {importStatus[playlist.id] === 'importing' ? (
                                    <span className="font-vt323 text-yellow-500 flex items-center">
                                      <span className="animate-spin h-4 w-4 border-2 border-yellow-500 rounded-full border-t-transparent mr-2"></span>
                                      IMPORTING...
                                    </span>
                                  ) : importStatus[playlist.id] === 'success' ? (
                                    <span className="font-vt323 text-green-500">IMPORTED ✓</span>
                                  ) : importStatus[playlist.id] === 'error' ? (
                                    <span className="font-vt323 text-red-500">FAILED ✗</span>
                                  ) : (
                                    <button
                                      onClick={() => importPlaylist(playlist.id)}
                                      className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-vt323 px-3 py-1 rounded-md transition-colors shadow-[0_0_5px_#1DB954] crt-glow-spotify"
                                    >
                                      IMPORT
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-black/30 p-4 border border-gray-800 rounded-md text-center">
                              <p className="font-vt323 text-green-400 mb-2">No Spotify playlists found.</p>
                              <div className="flex justify-center mt-2 space-x-3">
                                <button
                                  onClick={retryLoadingPlaylists}
                                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-vt323 px-3 py-1 rounded-md transition-colors shadow-[0_0_5px_#1DB954]"
                                >
                                  RETRY
                                </button>
                                <button
                                  onClick={fixSpotifyConnection}
                                  className="bg-yellow-600 hover:bg-yellow-500 text-white font-vt323 px-3 py-1 rounded-md transition-colors"
                                >
                                  RECONNECT
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
            
            <div className="p-4 border-t border-green-700 flex justify-between">
              <button 
                onClick={closeModal}
                className="font-vt323 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
              >
                CLOSE
              </button>
              <button 
                onClick={handleDone}
                className="font-vt323 bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-[0_0_8px_#00ff00] crt-glow"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 