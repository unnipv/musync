import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SyncButtonProps {
  playlistId: string;
}

/**
 * Component for syncing a playlist with connected platforms
 * 
 * @param props - Component props containing the playlist ID
 * @returns The sync button component
 */
export default function SyncButton({ playlistId }: SyncButtonProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles playlist synchronization
   */
  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch(`/api/playlists/${playlistId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync playlist');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync playlist');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-900 text-red-100 p-2 rounded mb-2 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="flex items-center bg-green-800 hover:bg-green-700 text-green-100 px-3 py-1 rounded-md transition-colors disabled:opacity-50 font-vt323"
      >
        <svg 
          className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        {isSyncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  );
} 