'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

/**
 * Button component for importing playlists from connected platforms
 * 
 * @returns The import playlists button component
 */
export default function ImportPlaylistsButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  /**
   * Opens the import playlists modal
   */
  const openModal = () => {
    setIsModalOpen(true);
    setError('');
    setMessage('');
  };
  
  /**
   * Closes the import playlists modal
   */
  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  /**
   * Connects to Spotify
   */
  const connectToSpotify = () => {
    setIsConnecting(true);
    signIn('spotify', { callbackUrl: '/playlists' });
  };
  
  /**
   * Imports playlists from Spotify
   */
  const importFromSpotify = async () => {
    setIsImporting(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetch('/api/import/spotify');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import playlists from Spotify');
      }
      
      const data = await response.json();
      setMessage(data.message);
      
      // Refresh the page after a short delay
      setTimeout(() => {
        router.refresh();
        closeModal();
      }, 2000);
    } catch (error) {
      console.error('Error importing from Spotify:', error);
      setError(error instanceof Error ? error.message : 'Failed to import playlists');
    } finally {
      setIsImporting(false);
    }
  };
  
  /**
   * Imports playlists from YouTube
   */
  const importFromYouTube = async () => {
    setIsImporting(true);
    setError('');
    setMessage('');
    
    try {
      // This would be implemented similarly to Spotify
      // For now, we'll just show a message
      setMessage('YouTube import is not implemented yet.');
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error importing from YouTube:', error);
      setError(error instanceof Error ? error.message : 'Failed to import playlists');
    } finally {
      setIsImporting(false);
    }
  };
  
  // Check if the user has a Spotify access token
  const hasSpotifyToken = !!session?.accessToken;
  
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
            
            {!hasSpotifyToken && (
              <div className="mb-4 p-3 bg-red-900/50 text-green-100 rounded border border-red-500 font-vt323 crt-error">
                Spotify account not connected. Please connect your Spotify account first.
                
                <button
                  onClick={connectToSpotify}
                  disabled={isConnecting}
                  className="w-full mt-3 flex items-center justify-center bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 shadow-[0_0_10px_#1DB954] crt-glow-spotify font-vt323"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Connect to Spotify
                </button>
              </div>
            )}
            
            <div className="space-y-4 mb-6">
              <button
                onClick={importFromSpotify}
                disabled={isImporting || !hasSpotifyToken}
                className="w-full flex items-center justify-center bg-[#1DB954] hover:bg-[#1ed760] text-black font-vt323 py-2 px-4 rounded-md transition-colors disabled:opacity-50 shadow-[0_0_10px_#1DB954] crt-glow-spotify"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Import from Spotify
              </button>
              
              <button
                onClick={importFromYouTube}
                disabled={isImporting}
                className="w-full flex items-center justify-center bg-red-700 hover:bg-red-600 text-white font-vt323 py-2 px-4 rounded-md transition-colors disabled:opacity-50 shadow-[0_0_10px_#ff0000] crt-glow-youtube"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Import from YouTube
              </button>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={closeModal}
                className="bg-gray-800 hover:bg-gray-700 text-green-500 font-vt323 px-4 py-2 rounded-md transition-colors border border-green-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 