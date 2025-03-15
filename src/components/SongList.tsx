'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// SVG icons instead of react-icons
const SpotifyIcon = () => (
  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TrashIcon = ({ pulsing = false }: { pulsing?: boolean }) => (
  <svg 
    className={`w-4 h-4 text-red-500 hover:text-red-400 ${pulsing ? 'animate-pulse' : ''}`} 
    viewBox="0 0 24 24" 
    fill="currentColor"
  >
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"/>
  </svg>
);

/**
 * Component for displaying and managing a list of songs in a playlist
 * 
 * @param props - Component props containing the playlist ID and songs array
 * @returns The song list component
 */
export default function SongList({ playlistId, songs }: { playlistId: string; songs: any[] }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Debug the songs data
  console.log('SongList received songs:', songs);
  
  /**
   * Removes a song from the playlist
   * 
   * @param songId - The ID of the song to remove
   */
  const handleRemoveSong = async (songId: string) => {
    setIsDeleting(songId);
    
    try {
      const response = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove song');
      }
      
      router.refresh();
    } catch (error) {
      console.error('Error removing song:', error);
      alert('Failed to remove song. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };
  
  /**
   * Formats the song duration from seconds to MM:SS format
   * 
   * @param seconds - The duration in seconds
   * @returns Formatted duration string
   */
  const formatDuration = (seconds: number) => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  /**
   * Gets the song ID safely from different data structures
   * 
   * @param song - The song object
   * @returns The song ID
   */
  const getSongId = (song: any) => {
    return song._id || song.id || '';
  };
  
  /**
   * Gets the song title safely from different data structures
   * 
   * @param song - The song object
   * @returns The song title
   */
  const getSongTitle = (song: any) => {
    return song.title || song.name || 'Unknown Title';
  };
  
  /**
   * Gets the song artist safely from different data structures
   * 
   * @param song - The song object
   * @returns The song artist
   */
  const getSongArtist = (song: any) => {
    return song.artist || (song.artists && song.artists[0]?.name) || 'Unknown Artist';
  };
  
  /**
   * Gets the song album safely from different data structures
   * 
   * @param song - The song object
   * @returns The song album
   */
  const getSongAlbum = (song: any) => {
    return song.album || (song.album && song.album.name) || '-';
  };
  
  if (!songs || !Array.isArray(songs) || songs.length === 0) {
    return <p className="text-green-400 italic">No songs in this playlist yet.</p>;
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-green-800">
            <th className="text-left py-2 px-4 text-green-500">#</th>
            <th className="text-left py-2 px-4 text-green-500">Title</th>
            <th className="text-left py-2 px-4 text-green-500">Artist</th>
            <th className="text-left py-2 px-4 text-green-500">Album</th>
            <th className="text-left py-2 px-4 text-green-500">Duration</th>
            <th className="text-left py-2 px-4 text-green-500">Services</th>
            <th className="text-left py-2 px-4 text-green-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song, index) => (
            <tr key={getSongId(song) || index} className="border-b border-green-900 hover:bg-green-900/20">
              <td className="py-2 px-4 text-green-400">{index + 1}</td>
              <td className="py-2 px-4 text-green-400">{getSongTitle(song)}</td>
              <td className="py-2 px-4 text-green-400">{getSongArtist(song)}</td>
              <td className="py-2 px-4 text-green-400">{getSongAlbum(song)}</td>
              <td className="py-2 px-4 text-green-400">{formatDuration(song.duration)}</td>
              <td className="py-2 px-4 text-green-400">
                <div className="flex space-x-2">
                  {song.spotifyId && <SpotifyIcon />}
                  {song.youtubeId && <YouTubeIcon />}
                </div>
              </td>
              <td className="py-2 px-4">
                <button
                  onClick={() => handleRemoveSong(getSongId(song))}
                  disabled={isDeleting === getSongId(song)}
                  className="transition-colors"
                  title="Remove song"
                >
                  <TrashIcon pulsing={isDeleting === getSongId(song)} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 