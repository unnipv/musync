'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Track {
  _id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  platformData: {
    provider: string;
    id: string;
    url: string;
  }[];
}

interface TrackListProps {
  tracks: Track[];
  playlistId: string;
  isOwner: boolean;
}

/**
 * Component to display a list of tracks in a playlist
 * 
 * @param tracks - The tracks to display
 * @param playlistId - The ID of the playlist
 * @param isOwner - Whether the current user owns the playlist
 * @returns A component displaying a list of tracks
 */
export default function TrackList({ tracks, playlistId, isOwner }: TrackListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removingTrackId, setRemovingTrackId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  
  /**
   * Formats a duration in seconds to a string in the format MM:SS
   * 
   * @param seconds - The duration in seconds
   * @returns A formatted duration string
   */
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  /**
   * Handles removing a track from the playlist
   * 
   * @param trackId - The ID of the track to remove
   */
  const handleRemoveTrack = async (trackId: string) => {
    if (removingTrackId === trackId) {
      setIsRemoving(true);
      setError(null);
      
      try {
        console.log('Removing track with ID:', trackId);
        
        // Make sure trackId is a string
        const trackIdString = String(trackId);
        
        // Use the track ID directly in the URL path instead of as a query parameter
        const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackIdString}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log('Response status:', response.status);
        
        // Check if the response is ok before trying to parse JSON
        if (!response.ok) {
          let errorMessage = `Failed to remove track (${response.status})`;
          const responseText = await response.text();
          console.log('Error response text:', responseText);
          
          try {
            if (responseText) {
              const data = JSON.parse(responseText);
              errorMessage = data.error || data.message || errorMessage;
            }
          } catch (parseError) {
            console.error('Error parsing error response:', parseError);
          }
          
          throw new Error(errorMessage);
        }
        
        // Parse the successful response
        try {
          const responseText = await response.text();
          console.log('Success response text:', responseText);
          
          if (responseText) {
            const data = JSON.parse(responseText);
            console.log('Track removed successfully:', data);
          }
          
          // Refresh the page to show updated playlist
          router.refresh();
        } catch (parseError) {
          console.error('Error parsing success response:', parseError);
          // Even if we can't parse the response, if the status was OK, consider it a success
          router.refresh();
        }
      } catch (err) {
        console.error('Error removing track:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsRemoving(false);
        setRemovingTrackId(null);
      }
    } else {
      setRemovingTrackId(trackId);
    }
  };
  
  /**
   * Handles playing a track
   * 
   * @param track - The track to play
   */
  const handlePlayTrack = (track: Track) => {
    // Get the first platform URL
    if (track.platformData && track.platformData.length > 0) {
      const platformData = track.platformData[0];
      if (platformData && platformData.url) {
        window.open(platformData.url, '_blank');
      }
    }
  };
  
  if (tracks.length === 0) {
    return (
      <div className="text-center py-12 text-green-400">
        <p className="text-xl mb-4">No tracks in this playlist</p>
        {isOwner && (
          <p>
            Import tracks from Spotify or YouTube to get started.
          </p>
        )}
      </div>
    );
  }
  
  return (
    <div>
      {error && (
        <div className="p-4 border border-red-500 bg-black text-red-500 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-green-500">
              <th className="px-4 py-2 text-left font-bold text-green-400">#</th>
              <th className="px-4 py-2 text-left font-bold text-green-400">TITLE</th>
              <th className="px-4 py-2 text-left font-bold text-green-400">ARTIST</th>
              <th className="px-4 py-2 text-left font-bold text-green-400">ALBUM</th>
              <th className="px-4 py-2 text-left font-bold text-green-400">DURATION</th>
              <th className="px-4 py-2 text-left font-bold text-green-400">SOURCE</th>
              {isOwner && (
                <th className="px-4 py-2 text-left font-bold text-green-400">ACTIONS</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, index) => (
              <tr 
                key={track._id} 
                className="border-b border-green-500/30 hover:bg-green-900/20 transition-colors cursor-pointer"
                onClick={() => handlePlayTrack(track)}
              >
                <td className="px-4 py-2 text-green-300">{index + 1}</td>
                <td className="px-4 py-2 text-green-300">{track.title}</td>
                <td className="px-4 py-2 text-green-300">{track.artist}</td>
                <td className="px-4 py-2 text-green-300">{track.album || '-'}</td>
                <td className="px-4 py-2 text-green-300">{formatDuration(track.duration)}</td>
                <td className="px-4 py-2">
                  <div className="flex space-x-1">
                    {track.platformData && track.platformData.map((platform: {provider: string; id: string; url: string}) => (
                      <span 
                        key={platform.provider} 
                        className="px-2 py-1 bg-green-900/50 text-green-400 text-xs"
                      >
                        {platform.provider.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </td>
                {isOwner && (
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTrack(track._id);
                      }}
                      disabled={isRemoving}
                      className={`px-2 py-1 ${
                        removingTrackId === track._id 
                          ? 'border border-red-500 text-red-400' 
                          : 'border border-green-500 text-green-400'
                      } text-xs hover:bg-green-900/30 transition-colors`}
                    >
                      {isRemoving && removingTrackId === track._id ? (
                        <span className="flex items-center">
                          <span className="animate-pulse mr-1">■</span>
                          REMOVING...
                        </span>
                      ) : removingTrackId === track._id ? (
                        'CONFIRM'
                      ) : (
                        'REMOVE'
                      )}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 