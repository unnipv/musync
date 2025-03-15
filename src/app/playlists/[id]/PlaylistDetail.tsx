'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlaylistForm from '@/components/PlaylistForm';
import TrackList from './TrackList';
import ImportButton from './ImportButton';
import SyncStatus from '@/components/SyncStatus';

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
  spotifyId?: string;
  youtubeId?: string;
  lastSyncedAt?: string;
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
 * @param props - Component properties
 * @returns React component
 */
export default function PlaylistDetail({ playlist, isOwner }: PlaylistDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if platforms are connected
  const spotifyConnected = !!playlist.spotifyId;
  const youtubeConnected = !!playlist.youtubeId;
  const lastSyncedAt = playlist.lastSyncedAt ? new Date(playlist.lastSyncedAt) : null;

  /**
   * Handles playlist deletion
   */
  const handleDelete = async () => {
    if (!isDeleting) return;
    
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete playlist');
      }
      
      router.push('/playlists');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 border border-red-500 bg-black text-red-500 rounded">
          <p>{error}</p>
        </div>
      )}
      
      {isEditing ? (
        <PlaylistForm
          initialData={{
            id: playlist._id,
            name: playlist.name,
            description: playlist.description,
            isPublic: playlist.isPublic
          }}
          mode="edit"
          onSuccess={() => {
            setIsEditing(false);
            router.refresh();
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-green-400 mb-2">{playlist.name}</h1>
              {playlist.description && (
                <p className="text-green-300 mb-4">{playlist.description}</p>
              )}
              <p className="text-green-200 text-sm">
                {playlist.tracks.length} tracks • Created {new Date(playlist.createdAt).toLocaleDateString()}
              </p>
            </div>
            
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 border border-green-500 text-green-400 hover:bg-green-900 hover:bg-opacity-30"
                >
                  EDIT
                </button>
                
                {isDeleting ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 border border-red-500 text-red-400 hover:bg-red-900 hover:bg-opacity-30"
                    >
                      CONFIRM
                    </button>
                    <button
                      onClick={() => setIsDeleting(false)}
                      className="px-4 py-2 border border-green-500 text-green-400 hover:bg-green-900 hover:bg-opacity-30"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsDeleting(true)}
                    className="px-4 py-2 border border-red-500 text-red-400 hover:bg-red-900 hover:bg-opacity-30"
                  >
                    DELETE
                  </button>
                )}
                
                <ImportButton playlistId={playlist._id} />
                
                <Link
                  href={`/playlists/${playlist._id}/connect`}
                  className="px-4 py-2 border border-blue-500 text-blue-400 hover:bg-blue-900 hover:bg-opacity-30"
                >
                  CONNECT
                </Link>
              </div>
            )}
          </div>
          
          {isOwner && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TrackList 
                  tracks={playlist.tracks} 
                  playlistId={playlist._id}
                  isOwner={isOwner}
                />
              </div>
              <div className="lg:col-span-1">
                <SyncStatus
                  playlistId={playlist._id}
                  spotifyConnected={spotifyConnected}
                  youtubeConnected={youtubeConnected}
                  lastSyncedAt={lastSyncedAt}
                />
              </div>
            </div>
          )}
          
          {!isOwner && (
            <TrackList 
              tracks={playlist.tracks} 
              playlistId={playlist._id}
              isOwner={isOwner}
            />
          )}
        </div>
      )}
    </div>
  );
} 