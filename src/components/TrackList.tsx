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
   * Gets a consistent ID for a track
   * @param track - The track to get an ID for
   * @param index - The index of the track in the list (fallback)
   * @returns A consistent ID string
   */
  const getTrackKey = (track: PlaylistTrack, index?: number) => {
    // For display/React key purposes, create a reliable key
    return track.id || track._id?.toString() || `${track.title}-${track.artist}-${index}`;
  };

  /**
   * Gets the best ID to use for database operations
   * @param track - The track to get an ID for
   * @returns The best ID to use for database operations
   */
  const getTrackDbId = (track: PlaylistTrack) => {
    // For database operations, prefer MongoDB ID
    return track._id?.toString() || track.id;
  };

  /**
   * Removes a track from the playlist
   * @param track - The track to remove
   * @param index - The index of the track in the list
   */
  const removeTrack = async (track: PlaylistTrack, index: number) => {
    // Get the MongoDB ID if available, otherwise use our generated key
    const trackId = getTrackDbId(track) || getTrackKey(track, index);
    
    if (!trackId) {
      setError("Invalid track ID");
      return;
    }
    
    try {
      setLoading(getTrackKey(track, index));
      setError(null);
      
      console.log(`Removing track: ${track.title} with ID: ${trackId}`);
      
      const response = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          trackIds: [trackId],
          trackTitle: track.title // Send the title as well for fallback matching
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove track');
      }

      // Update local state if callback provided
      if (onTracksChange) {
        const updatedTracks = tracks.filter((t, idx) => idx !== index);
        onTracksChange(updatedTracks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove track');
      console.error('Error removing track:', err);
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
      
      {tracks.map((track, index) => {
        // Create a reliable unique key using track properties or fallback to index
        const trackKey = getTrackKey(track, index);
        
        return (
          <div
            key={trackKey}
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
                  onClick={() => removeTrack(track, index)}
                  disabled={loading === getTrackKey(track, index)}
                  className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50 font-vt323"
                >
                  {loading === getTrackKey(track, index) ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
} 