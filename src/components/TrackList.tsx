import { useState } from 'react';
import { PlaylistTrack } from '@/lib/models/playlist';

interface TrackListProps {
  tracks: PlaylistTrack[];
  playlistId: string;
  isOwner: boolean;
  onTracksChange?: (tracks: PlaylistTrack[]) => void;
}

/**
 * Component for displaying and managing a list of tracks
 */
export default function TrackList({ tracks, playlistId, isOwner, onTracksChange }: TrackListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Removes a track from the playlist
   * @param trackId - The ID of the track to remove
   */
  const removeTrack = async (trackId: string) => {
    try {
      setLoading(trackId);
      setError(null);
      
      const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove track');
      }

      // Update local state if callback provided
      if (onTracksChange) {
        const updatedTracks = tracks.filter(track => track.id !== trackId);
        onTracksChange(updatedTracks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove track');
    } finally {
      setLoading(null);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="text-center text-green-400 p-4 font-vt323">
        <p>No tracks in this playlist yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-900 text-red-100 p-2 rounded mb-4">
          {error}
        </div>
      )}
      
      {tracks.map((track) => (
        <div
          key={track.id}
          className="bg-black p-4 rounded-lg border border-green-500 flex items-center justify-between group hover:border-green-400 transition-colors"
        >
          <div className="flex items-center space-x-4">
            {track.imageUrl && (
              <img
                src={track.imageUrl}
                alt={`${track.title} cover`}
                className="w-12 h-12 rounded"
              />
            )}
            <div>
              <h3 className="text-green-500 font-bold font-vt323">{track.title}</h3>
              <p className="text-green-400 text-sm font-vt323">{track.artist}</p>
              {track.album && (
                <p className="text-green-600 text-xs font-vt323">{track.album}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-green-600 text-sm font-vt323">
              {track.platform}
            </span>
            {isOwner && (
              <button
                onClick={() => removeTrack(track.id || "")}
                disabled={loading === track.id}
                className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50 font-vt323"
              >
                {loading === track.id ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 