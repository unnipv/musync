'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

/**
 * Button component for importing playlists from connected platforms
 * 
 * @returns The import playlists button component
 */
export default function ImportPlaylistsButton() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({
    spotify: false,
    youtube: false
  });
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [connections, setConnections] = useState({
    spotify: false,
    youtube: false
  });
  const [playlists, setPlaylists] = useState<{
    spotify: any[],
    youtube: any[]
  }>({
    spotify: [],
    youtube: []
  });
  const [importStatus, setImportStatus] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'spotify' | 'youtube'>('youtube');
  
  /**
   * Checks if the user is connected to platforms
   */
  const checkConnections = async () => {
    try {
      setIsCheckingConnection(true);
      setError('');
      
      // Check YouTube connection
      const youtubeResponse = await fetch('/api/connect/youtube');
      const youtubeData = await youtubeResponse.json();
      
      // Check Spotify connection
      const spotifyResponse = await fetch('/api/connect/spotify');
      const spotifyData = await spotifyResponse.json();
      
      console.log('Connection check responses:', { 
        youtube: youtubeData, 
        spotify: spotifyData 
      });
      
      setConnections({
        youtube: youtubeData.connected,
        spotify: spotifyData.connected
      });
      
      // If connected to YouTube, fetch playlists
      if (youtubeData.connected) {
        fetchYoutubePlaylists();
      }
      
      // If connected to Spotify, fetch playlists
      if (spotifyData.connected) {
        fetchSpotifyPlaylists();
      }
      
      // Set active tab to the first connected platform
      if (youtubeData.connected) {
        setActiveTab('youtube');
      } else if (spotifyData.connected) {
        setActiveTab('spotify');
      }
      
    } catch (err) {
      console.error('Error checking connections:', err);
      setError('Error checking platform connections. Please try again.');
    } finally {
      setIsCheckingConnection(false);
    }
  };
  
  /**
   * Fetches playlists from YouTube Music
   */
  const fetchYoutubePlaylists = async () => {
    try {
      setIsImporting(true);
      
      const response = await fetch('/api/import/youtube');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPlaylists(prev => ({
          ...prev,
          youtube: data.playlists || []
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch YouTube playlists');
      }
    } catch (err) {
      console.error('Error fetching YouTube playlists:', err);
      setError('Error fetching YouTube playlists. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };
  
  /**
   * Fetches playlists from Spotify
   */
  const fetchSpotifyPlaylists = async () => {
    try {
      setIsImporting(true);
      
      const response = await fetch('/api/import/spotify');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPlaylists(prev => ({
          ...prev,
          spotify: data.playlists || []
        }));
      } else {
        throw new Error(data.error || 'Failed to fetch Spotify playlists');
      }
    } catch (err) {
      console.error('Error fetching Spotify playlists:', err);
      setError('Error fetching Spotify playlists. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };
  
  /**
   * Effect to check connections when session changes or modal opens
   */
  useEffect(() => {
    if (isModalOpen && status === 'authenticated') {
      checkConnections();
    }
  }, [isModalOpen, session, status]);
  
  /**
   * Opens the import playlists modal
   */
  const openModal = () => {
    setIsModalOpen(true);
    setError('');
    setMessage('');
    setPlaylists({ spotify: [], youtube: [] });
    setImportStatus({});
  };
  
  /**
   * Closes the import playlists modal
   */
  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  /**
   * Connects to YouTube Music
   */
  const connectToYoutube = () => {
    setIsConnecting(prev => ({ ...prev, youtube: true }));
    
    // Add a timestamp to prevent caching issues
    const timestamp = Date.now();
    
    // Use a more specific callback URL with a special parameter to indicate we're connecting YouTube
    const callbackUrl = `${window.location.origin}/playlists?connect=youtube&t=${timestamp}`;
    console.log('Connecting to YouTube with callback:', callbackUrl);
    
    // Store the callback URL in localStorage so we can check it when we return
    localStorage.setItem('youtubeConnectCallback', callbackUrl);
    
    signIn('google', { callbackUrl });
  };
  
  /**
   * Connects to Spotify
   */
  const connectToSpotify = () => {
    setIsConnecting(prev => ({ ...prev, spotify: true }));
    
    // Add a timestamp to prevent caching issues
    const timestamp = Date.now();
    
    // Use a more specific callback URL with a special parameter to indicate we're connecting Spotify
    const callbackUrl = `${window.location.origin}/playlists?connect=spotify&t=${timestamp}`;
    console.log('Connecting to Spotify with callback:', callbackUrl);
    
    // Store the callback URL in localStorage so we can check it when we return
    localStorage.setItem('spotifyConnectCallback', callbackUrl);
    
    signIn('spotify', { callbackUrl });
  };
  
  /**
   * Effect to check if we've just returned from OAuth authentication
   */
  useEffect(() => {
    const checkAuth = async () => {
      // Check if we have stored callback URLs
      const youtubeCallback = localStorage.getItem('youtubeConnectCallback');
      const spotifyCallback = localStorage.getItem('spotifyConnectCallback');
      
      if (!youtubeCallback && !spotifyCallback) return;
      
      // Check if the current URL contains the connect parameter
      const urlParams = new URLSearchParams(window.location.search);
      const connectParam = urlParams.get('connect');
      
      if (connectParam === 'youtube' && youtubeCallback && session?.accessToken) {
        console.log('Detected return from Google auth, completing connection...');
        
        try {
          // Get the YouTube user ID from the profile API
          const profileResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
            headers: {
              Authorization: `Bearer ${session.accessToken}`
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
          
          // Clear the stored callback URL
          localStorage.removeItem('youtubeConnectCallback');
          
          // Remove the connect parameter from the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('connect');
          newUrl.searchParams.delete('t');
          window.history.replaceState({}, '', newUrl);
          
          // Refresh the page to update the UI
          router.refresh();
        } catch (error) {
          console.error('Error completing YouTube connection:', error);
        }
      } else if (connectParam === 'spotify' && spotifyCallback && session?.accessToken) {
        console.log('Detected return from Spotify auth, completing connection...');
        
        try {
          // Get the Spotify user ID from the profile API
          const profileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              Authorization: `Bearer ${session.accessToken}`
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
          
          // Clear the stored callback URL
          localStorage.removeItem('spotifyConnectCallback');
          
          // Remove the connect parameter from the URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('connect');
          newUrl.searchParams.delete('t');
          window.history.replaceState({}, '', newUrl);
          
          // Refresh the page to update the UI
          router.refresh();
        } catch (error) {
          console.error('Error completing Spotify connection:', error);
        }
      }
    };
    
    if (status === 'authenticated' && session?.accessToken) {
      checkAuth();
    }
  }, [session, status, router]);
  
  /**
   * Imports a playlist from the active platform
   * 
   * @param playlistId - The playlist ID to import
   */
  const importPlaylist = async (playlistId: string) => {
    setImportStatus(prev => ({ ...prev, [playlistId]: 'importing' }));
    
    try {
      const endpoint = activeTab === 'youtube' ? '/api/import/youtube' : '/api/import/spotify';
      const body = activeTab === 'youtube' 
        ? { youtubePlaylistId: playlistId } 
        : { spotifyPlaylistId: playlistId };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setImportStatus(prev => ({ ...prev, [playlistId]: 'success' }));
      } else {
        throw new Error(data.error || 'Failed to import playlist');
      }
    } catch (error) {
      console.error('Error importing playlist:', error);
      setImportStatus(prev => ({ ...prev, [playlistId]: 'error' }));
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
    const isYoutube = platform === 'youtube';
    const connectFn = isYoutube ? connectToYoutube : connectToSpotify;
    const isConnectingPlatform = isConnecting[platform];
    
    return (
      <button
        onClick={connectFn}
        disabled={isConnectingPlatform}
        className={`w-full mt-3 flex items-center justify-center ${
          isYoutube 
            ? 'bg-red-700 hover:bg-red-600 shadow-[0_0_10px_#ff0000] crt-glow-youtube' 
            : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[0_0_10px_#1DB954] crt-glow-spotify'
        } text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 font-vt323`}
      >
        {isYoutube ? (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        )}
        {isConnectingPlatform 
          ? 'Connecting...' 
          : `Connect to ${isYoutube ? 'YouTube Music' : 'Spotify'}`}
      </button>
    );
  };
  
  return (
    <>
      <button
        onClick={openModal}
        className="bg-blue-900 hover:bg-blue-800 text-green-100 font-vt323 px-4 py-2 rounded-md transition-colors shadow-[0_0_10px_#0066ff] crt-glow-blue"
      >
        Import Playlists
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 crt-overlay">
          <div className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-[0_0_15px_#00ff00] w-full max-w-md crt-panel">
            <h2 className="text-2xl font-bold text-green-500 font-vt323 mb-4 crt-text">Import Playlists</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 text-green-100 rounded border border-red-500 font-vt323 crt-error">
                {error}
              </div>
            )}
            
            {message && (
              <div className="mb-4 p-3 bg-green-900/50 text-green-100 rounded border border-green-500 font-vt323 crt-success">
                {message}
              </div>
            )}
            
            {isCheckingConnection && (
              <div className="mb-4 p-3 bg-blue-900/50 text-green-100 rounded border border-blue-500 font-vt323">
                Checking platform connections...
              </div>
            )}
            
            {/* Platform tabs */}
            {(connections.youtube || connections.spotify) && (
              <div className="mb-4 border-b border-green-700">
                <div className="flex">
                  {connections.youtube && (
                    <button
                      onClick={() => setActiveTab('youtube')}
                      className={`py-2 px-4 font-vt323 ${
                        activeTab === 'youtube'
                          ? 'bg-red-900/30 text-red-400 border-t border-l border-r border-red-700'
                          : 'text-green-500 hover:text-green-400'
                      }`}
                    >
                      YouTube Music
                    </button>
                  )}
                  {connections.spotify && (
                    <button
                      onClick={() => setActiveTab('spotify')}
                      className={`py-2 px-4 font-vt323 ${
                        activeTab === 'spotify'
                          ? 'bg-green-900/30 text-green-400 border-t border-l border-r border-green-700'
                          : 'text-green-500 hover:text-green-400'
                      }`}
                    >
                      Spotify
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* YouTube Music content */}
            {activeTab === 'youtube' && (
              <div className="space-y-4 mb-6">
                {!connections.youtube ? (
                  <div className="p-4 text-center border border-red-700 rounded-md">
                    <p className="font-vt323 text-green-300 mb-3">
                      Connect to YouTube Music to import your playlists
                    </p>
                    {renderConnectionButton('youtube')}
                  </div>
                ) : (
                  <>
                    <h3 className="font-vt323 text-xl text-green-500 mb-2">YOUTUBE MUSIC PLAYLISTS</h3>
                    
                    {isImporting ? (
                      <div className="p-4 text-center font-vt323">
                        Loading playlists...
                      </div>
                    ) : playlists.youtube.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto">
                        {playlists.youtube.map(playlist => (
                          <div 
                            key={playlist.id}
                            className="border border-green-700 p-3 mb-2 rounded-md"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-vt323 text-lg text-green-300">{playlist.name}</h4>
                                <p className="font-vt323 text-sm text-green-500">{playlist.tracks.total} tracks</p>
                              </div>
                              
                              {importStatus[playlist.id] === 'importing' ? (
                                <span className="font-vt323 text-yellow-500">IMPORTING...</span>
                              ) : importStatus[playlist.id] === 'success' ? (
                                <span className="font-vt323 text-green-500">IMPORTED</span>
                              ) : importStatus[playlist.id] === 'error' ? (
                                <span className="font-vt323 text-red-500">FAILED</span>
                              ) : (
                                <button
                                  onClick={() => importPlaylist(playlist.id)}
                                  className="bg-red-700 hover:bg-red-600 text-white font-vt323 px-3 py-1 rounded-md transition-colors shadow-[0_0_5px_#ff0000] crt-glow-youtube"
                                >
                                  IMPORT
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center font-vt323 text-green-300 border border-green-700 rounded-md">
                        No YouTube Music playlists found
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* Spotify content */}
            {activeTab === 'spotify' && (
              <div className="space-y-4 mb-6">
                {!connections.spotify ? (
                  <div className="p-4 text-center border border-green-700 rounded-md">
                    <p className="font-vt323 text-green-300 mb-3">
                      Connect to Spotify to import your playlists
                    </p>
                    {renderConnectionButton('spotify')}
                  </div>
                ) : (
                  <>
                    <h3 className="font-vt323 text-xl text-green-500 mb-2">SPOTIFY PLAYLISTS</h3>
                    
                    {isImporting ? (
                      <div className="p-4 text-center font-vt323">
                        Loading playlists...
                      </div>
                    ) : playlists.spotify.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto">
                        {playlists.spotify.map(playlist => (
                          <div 
                            key={playlist.id}
                            className="border border-green-700 p-3 mb-2 rounded-md"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-vt323 text-lg text-green-300">{playlist.name}</h4>
                                <p className="font-vt323 text-sm text-green-500">{playlist.tracks.total} tracks</p>
                              </div>
                              
                              {importStatus[playlist.id] === 'importing' ? (
                                <span className="font-vt323 text-yellow-500">IMPORTING...</span>
                              ) : importStatus[playlist.id] === 'success' ? (
                                <span className="font-vt323 text-green-500">IMPORTED</span>
                              ) : importStatus[playlist.id] === 'error' ? (
                                <span className="font-vt323 text-red-500">FAILED</span>
                              ) : (
                                <button
                                  onClick={() => importPlaylist(playlist.id)}
                                  className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-vt323 px-3 py-1 rounded-md transition-colors shadow-[0_0_5px_#1DB954] crt-glow-spotify"
                                >
                                  IMPORT
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center font-vt323 text-green-300 border border-green-700 rounded-md">
                        No Spotify playlists found
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* No connections message */}
            {!connections.youtube && !connections.spotify && !isCheckingConnection && (
              <div className="mb-6 p-4 border border-yellow-700 rounded-md">
                <p className="font-vt323 text-yellow-300 mb-4 text-center">
                  Connect to a music platform to import your playlists
                </p>
                <div className="space-y-3">
                  {renderConnectionButton('youtube')}
                  {renderConnectionButton('spotify')}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={closeModal}
                className="bg-gray-800 hover:bg-gray-700 text-green-500 font-vt323 px-4 py-2 rounded-md transition-colors border border-green-700"
              >
                CLOSE
              </button>
              
              <button
                onClick={handleDone}
                className="bg-green-900 hover:bg-green-800 text-green-100 font-vt323 px-4 py-2 rounded-md transition-colors shadow-[0_0_10px_#00ff00] crt-glow-green"
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