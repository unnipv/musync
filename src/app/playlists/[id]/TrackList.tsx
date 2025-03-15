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
  
  /**
   * Formats a duration in seconds to a string in the format MM:SS
   * 
   * @param seconds - The duration in seconds
   * @returns A formatted duration string
   */
  const formatDuration = (seconds: number) => {
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
      try {
        const response = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to remove track');
        }
        
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      } finally {
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
      <div className="text-center py-12">
        <p className="font-retro text-xl mb-4">No tracks in this playlist</p>
        {isOwner && (
          <p className="font-retro">
            Import tracks from Spotify or YouTube to get started.
          </p>
        )}
      </div>
    );
  }
  
  return (
    <div>
      {error && (
        <div className="bg-red-500 text-white p-4 rounded font-retro mb-4">
          {error}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-phosphor">
              <th className="px-4 py-2 text-left font-pixel phosphor-text">#</th>
              <th className="px-4 py-2 text-left font-pixel phosphor-text">TITLE</th>
              <th className="px-4 py-2 text-left font-pixel phosphor-text">ARTIST</th>
              <th className="px-4 py-2 text-left font-pixel phosphor-text">ALBUM</th>
              <th className="px-4 py-2 text-left font-pixel phosphor-text">DURATION</th>
              <th className="px-4 py-2 text-left font-pixel phosphor-text">SOURCE</th>
              {isOwner && (
                <th className="px-4 py-2 text-left font-pixel phosphor-text">ACTIONS</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, index) => (
              <tr 
                key={track._id} 
                className="border-b border-phosphor hover:bg-phosphor-dark/20 transition-colors cursor-pointer"
                onClick={() => handlePlayTrack(track)}
              >
                <td className="px-4 py-2 font-retro">{index + 1}</td>
                <td className="px-4 py-2 font-retro">{track.title}</td>
                <td className="px-4 py-2 font-retro">{track.artist}</td>
                <td className="px-4 py-2 font-retro">{track.album || '-'}</td>
                <td className="px-4 py-2 font-retro">{formatDuration(track.duration)}</td>
                <td className="px-4 py-2 font-retro">
                  <div className="flex space-x-1">
                    {track.platformData && track.platformData.map((platform: {provider: string; id: string; url: string}) => (
                      <span 
                        key={platform.provider} 
                        className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro"
                      >
                        {platform.provider.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </td>
                {isOwner && (
                  <td className="px-4 py-2 font-retro">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveTrack(track._id);
                      }}
                      className={`px-2 py-1 ${
                        removingTrackId === track._id 
                          ? 'bg-red-500 text-white' 
                          : 'bg-phosphor-dark text-phosphor'
                      } text-xs font-retro`}
                    >
                      {removingTrackId === track._id ? 'CONFIRM' : 'REMOVE'}
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