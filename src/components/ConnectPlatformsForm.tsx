'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

// SVG icons
const SpotifyIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

/**
 * Component for connecting streaming platforms to a playlist
 * 
 * @param props - Component props containing the playlist ID and existing connections
 * @returns The connect platforms form component
 */
export default function ConnectPlatformsForm({
  playlistId,
  existingConnections = []
}: {
  playlistId: string;
  existingConnections: any[];
}) {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Check if platforms are already connected
  const spotifyConnection = existingConnections.find(conn => conn.platform === 'spotify');
  const youtubeConnection = existingConnections.find(conn => conn.platform === 'youtube');
  
  // Check for error parameters in the URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const errorParam = url.searchParams.get('error');
    const errorDetails = url.searchParams.get('details');
    
    if (errorParam) {
      let errorMessage = '';
      
      switch (errorParam) {
        case 'spotify_profile':
          errorMessage = 'Failed to get Spotify profile. Please try again.';
          break;
        case 'user_not_found':
          errorMessage = 'User not found. Please try signing in again.';
          break;
        case 'spotify_create_playlist':
          errorMessage = 'Failed to create Spotify playlist. Please check your Spotify account permissions.';
          break;
        case 'connection_failed':
          errorMessage = 'Failed to connect to the platform. Please try again.';
          break;
        default:
          errorMessage = 'An error occurred. Please try again.';
      }
      
      // Add error details if available
      if (errorDetails) {
        errorMessage += ` Details: ${errorDetails}`;
      }
      
      setError(errorMessage);
      
      // Remove the error parameter from the URL
      url.searchParams.delete('error');
      url.searchParams.delete('details');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);
  
  /**
   * Connects a streaming platform to the playlist
   * 
   * @param platform - The platform to connect ('spotify' or 'youtube')
   */
  const connectPlatform = (platform: 'spotify' | 'youtube') => {
    setIsConnecting(true);
    setError('');
    setMessage('');
    
    // Store the current URL so we can redirect back after auth
    const callbackUrl = `${window.location.origin}/playlists/${playlistId}/connect?platform=${platform}`;
    localStorage.setItem(`${platform}ConnectCallback`, callbackUrl);
    localStorage.setItem('connectPlaylistId', playlistId);
    
    // Redirect to the appropriate authentication provider
    signIn(platform === 'spotify' ? 'spotify' : 'google', { callbackUrl });
  };
  
  /**
   * Disconnects a platform from the playlist
   * 
   * @param platform - The platform to disconnect ('spotify' or 'youtube')
   */
  const disconnectPlatform = async (platform: 'spotify' | 'youtube') => {
    try {
      setIsConnecting(true);
      setError('');
      setMessage('');
      
      // Call API to disconnect the platform
      const response = await fetch(`/api/playlists/${playlistId}/platforms/${platform}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to disconnect ${platform}`);
      }
      
      setMessage(`${platform.charAt(0).toUpperCase() + platform.slice(1)} disconnected successfully`);
      
      // Refresh the page to show updated connections
      router.refresh();
    } catch (error) {
      setError(`Error disconnecting ${platform}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsConnecting(false);
    }
  };
  
  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-900 text-green-100 rounded">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mb-4 p-3 bg-green-900 text-green-100 rounded">
          {message}
        </div>
      )}
      
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border border-green-700 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="text-green-500">
              <SpotifyIcon />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-500">Spotify</h3>
              <p className="text-green-400">
                {spotifyConnection 
                  ? `Connected (ID: ${spotifyConnection.platformId})` 
                  : 'Not connected'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => spotifyConnection 
              ? disconnectPlatform('spotify') 
              : connectPlatform('spotify')}
            disabled={isConnecting}
            className={`px-4 py-2 rounded-md transition-colors ${
              spotifyConnection
                ? 'bg-red-900 hover:bg-red-800 text-green-100'
                : 'bg-green-600 hover:bg-green-500 text-black'
            } disabled:opacity-50`}
          >
            {isConnecting ? 'Loading...' : (spotifyConnection ? 'Disconnect' : 'Connect')}
          </button>
        </div>
        
        <div className="flex items-center justify-between p-4 border border-green-700 rounded-lg">
          <div className="flex items-center space-x-4">
            <div className="text-red-500">
              <YouTubeIcon />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-500">YouTube Music</h3>
              <p className="text-green-400">
                {youtubeConnection 
                  ? `Connected (ID: ${youtubeConnection.platformId})` 
                  : 'Not connected'}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => youtubeConnection 
              ? disconnectPlatform('youtube') 
              : connectPlatform('youtube')}
            disabled={isConnecting}
            className={`px-4 py-2 rounded-md transition-colors ${
              youtubeConnection
                ? 'bg-red-900 hover:bg-red-800 text-green-100'
                : 'bg-red-700 hover:bg-red-600 text-white'
            } disabled:opacity-50`}
          >
            {isConnecting ? 'Loading...' : (youtubeConnection ? 'Disconnect' : 'Connect')}
          </button>
        </div>
      </div>
      
      <div className="mt-8 flex justify-between">
        <button
          onClick={() => router.push(`/playlists/${playlistId}`)}
          className="bg-gray-800 hover:bg-gray-700 text-green-500 px-4 py-2 rounded-md transition-colors"
        >
          Back to Playlist
        </button>
      </div>
    </div>
  );
} 