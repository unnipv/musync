'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportButtonProps {
  playlistId: string;
}

/**
 * Button component for importing tracks from external services
 * 
 * @param playlistId - The ID of the playlist to import tracks to
 * @returns A button component for importing tracks
 */
export default function ImportButton({ playlistId }: ImportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Handles importing from Spotify
   */
  const handleImportFromSpotify = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/import/spotify?playlistId=${playlistId}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to import from Spotify');
      }
      
      // Close the dropdown and refresh the page
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handles importing from YouTube
   */
  const handleImportFromYouTube = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/import/youtube?playlistId=${playlistId}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to import from YouTube');
      }
      
      // Close the dropdown and refresh the page
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="pixel-button"
        disabled={isLoading}
      >
        {isLoading ? 'IMPORTING...' : 'IMPORT'}
      </button>
      
      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-500 text-white p-2 rounded font-retro text-sm z-10 w-64">
          {error}
        </div>
      )}
      
      {isOpen && !isLoading && (
        <div className="absolute top-full mt-2 right-0 bg-black border border-phosphor p-2 z-10 w-48">
          <button 
            onClick={handleImportFromSpotify}
            className="w-full text-left p-2 font-retro hover:bg-phosphor-dark transition-colors"
          >
            FROM SPOTIFY
          </button>
          <button 
            onClick={handleImportFromYouTube}
            className="w-full text-left p-2 font-retro hover:bg-phosphor-dark transition-colors"
          >
            FROM YOUTUBE
          </button>
        </div>
      )}
    </div>
  );
} 