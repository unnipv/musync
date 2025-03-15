'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AddSongFormProps {
  playlistId: string;
}

/**
 * Component for adding new songs to a playlist
 * 
 * @param props - Component props containing the playlist ID
 * @returns The add song form component
 */
export default function AddSongForm({ playlistId }: AddSongFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles form submission to add a new song
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add song');
      }

      setUrl('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add song');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900 text-red-100 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex space-x-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter Spotify or YouTube URL"
          className="flex-1 bg-black border border-green-500 text-green-500 p-2 rounded font-vt323"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url}
          className="bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded transition-colors disabled:opacity-50 font-vt323"
        >
          {loading ? 'Adding...' : 'Add Song'}
        </button>
      </div>
    </form>
  );
} 