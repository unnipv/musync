'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SyncButtonProps {
  playlistId: string;
}

/**
 * Button component for synchronizing a playlist across platforms
 * 
 * @param playlistId - The ID of the playlist to synchronize
 * @returns A button component for synchronizing a playlist
 */
export default function SyncButton({ playlistId }: SyncButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  /**
   * Handles synchronizing the playlist
   */
  const handleSync = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`/api/playlists/${playlistId}/sync`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to synchronize playlist');
      }
      
      setSuccess('Playlist synchronized successfully!');
      
      // Refresh the page after a short delay
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="relative">
      <button 
        onClick={handleSync} 
        className="pixel-button"
        disabled={isLoading}
      >
        {isLoading ? 'SYNCING...' : 'SYNC'}
      </button>
      
      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-500 text-white p-2 rounded font-retro text-sm z-10 w-64">
          {error}
        </div>
      )}
      
      {success && (
        <div className="absolute top-full mt-2 right-0 bg-green-500 text-white p-2 rounded font-retro text-sm z-10 w-64">
          {success}
        </div>
      )}
    </div>
  );
} 