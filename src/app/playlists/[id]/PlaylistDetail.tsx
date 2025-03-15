'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlaylistForm from '@/components/PlaylistForm';
import TrackList from './TrackList';
import ImportButton from './ImportButton';
import SyncButton from './SyncButton';

interface PlatformData {
  provider: string;
  id: string;
  url: string;
  synced: boolean;
}

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

interface Playlist {
  _id: string;
  name: string;
  description: string;
  userId: string;
  isPublic: boolean;
  tracks: Track[];
  platformData: PlatformData[];
  createdAt: string;
  updatedAt: string;
}

interface PlaylistDetailProps {
  playlist: Playlist;
  isOwner: boolean;
}

/**
 * Component to display and manage a playlist's details
 * 
 * @param playlist - The playlist data to display
 * @param isOwner - Whether the current user owns the playlist
 * @returns A component displaying the playlist details
 */
export default function PlaylistDetail({ playlist, isOwner }: PlaylistDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Determine which platforms this playlist is on
  const platforms = playlist.platformData.map(p => p.provider);
  const isOnSpotify = platforms.includes('spotify');
  const isOnYouTube = platforms.includes('youtube');
  
  /**
   * Handles deleting the playlist
   */
  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete playlist');
      }
      
      router.push('/playlists');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setIsDeleting(false);
    }
  };
  
  /**
   * Handles successful playlist update
   */
  const handleUpdateSuccess = () => {
    setIsEditing(false);
    router.refresh();
  };
  
  if (isEditing && isOwner) {
    return (
      <div>
        <div className="mb-8">
          <button 
            onClick={() => setIsEditing(false)} 
            className="pixel-button"
          >
            BACK
          </button>
        </div>
        
        <h1 className="text-4xl font-pixel phosphor-text mb-8">EDIT PLAYLIST</h1>
        
        <PlaylistForm 
          mode="edit" 
          initialData={{
            id: playlist._id,
            name: playlist.name,
            description: playlist.description,
            isPublic: playlist.isPublic
          }}
          onSuccess={handleUpdateSuccess}
        />
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-8">
        <Link href="/playlists" className="pixel-button">
          BACK
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-500 text-white p-4 rounded font-retro mb-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-8">
        <div>
          <h1 className="text-4xl font-pixel phosphor-text mb-2">{playlist.name}</h1>
          
          {playlist.description && (
            <p className="font-retro mb-4">{playlist.description}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            {isOnSpotify && (
              <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
                SPOTIFY
              </span>
            )}
            
            {isOnYouTube && (
              <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
                YOUTUBE
              </span>
            )}
            
            {!playlist.isPublic && (
              <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
                PRIVATE
              </span>
            )}
          </div>
          
          <p className="font-retro text-sm mb-4">
            {playlist.tracks.length} tracks
          </p>
        </div>
        
        {isOwner && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button 
              onClick={() => setIsEditing(true)} 
              className="pixel-button"
            >
              EDIT
            </button>
            
            <button 
              onClick={handleDelete} 
              className={`pixel-button ${isDeleting ? 'bg-red-500 text-white' : ''}`}
            >
              {isDeleting ? 'CONFIRM DELETE' : 'DELETE'}
            </button>
            
            <ImportButton playlistId={playlist._id} />
            
            {playlist.platformData.length > 1 && (
              <SyncButton playlistId={playlist._id} />
            )}
          </div>
        )}
      </div>
      
      <TrackList 
        tracks={playlist.tracks} 
        playlistId={playlist._id} 
        isOwner={isOwner} 
      />
    </div>
  );
} 