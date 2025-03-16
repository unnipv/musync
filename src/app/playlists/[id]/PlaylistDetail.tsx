'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlaylistForm from '@/components/PlaylistForm';
import TrackList from './TrackList';
import ImportButton from './ImportButton';
import SyncStatus from '@/components/SyncStatus';
import EnhancedSyncButtons from './EnhancedSyncButtons';

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
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-pixel text-phosphor">ACTIONS</h2>
                </div>
                
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <ImportButton playlistId={playlist._id} />
                    <Link href={`/playlists/${playlist._id}/connect`} className="pixel-button">
                      CONNECT
                    </Link>
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="pixel-button"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => setIsDeleting(prev => !prev)}
                      className={`pixel-button ${isDeleting ? 'bg-red-500' : ''}`}
                    >
                      {isDeleting ? 'CONFIRM DELETE?' : 'DELETE'}
                    </button>
                    {isDeleting && (
                      <button
                        onClick={handleDelete}
                        className="pixel-button bg-red-500"
                      >
                        YES, DELETE
                      </button>
                    )}
                  </div>
                  
                  <EnhancedSyncButtons 
                    playlistId={playlist._id} 
                    spotifyConnected={spotifyConnected}
                    youtubeConnected={youtubeConnected}
                    spotifyId={playlist.spotifyId}
                    youtubeId={playlist.youtubeId}
                  />
                </div>
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
                <div className="font-mono text-green-400 bg-black p-4 rounded border border-green-500 shadow-lg shadow-green-500/20 relative overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none bg-scan-lines opacity-10"></div>
                  
                  <h3 className="text-xl mb-4 font-bold tracking-wide">
                    <span className="inline-block w-3 h-3 bg-green-500 mr-2 animate-pulse"></span>
                    PLATFORM STATUS
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    <div className="flex justify-between">
                      <span>SPOTIFY:</span>
                      <span className={spotifyConnected ? 'text-green-500' : 'text-red-500'}>
                        {spotifyConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>YOUTUBE:</span>
                      <span className={youtubeConnected ? 'text-green-500' : 'text-red-500'}>
                        {youtubeConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>LAST SYNCED:</span>
                      <span>{lastSyncedAt 
                        ? new Date(lastSyncedAt).toLocaleString().replace(/,/g, '') 
                        : 'NEVER'}</span>
                    </div>
                    
                    {(spotifyConnected || youtubeConnected) && (
                      <div className="mt-2 border-t border-green-500 pt-2">
                        <div className="text-green-500 mb-2">PLATFORM LINKS:</div>
                        <div className="flex flex-col gap-2">
                          {spotifyConnected && playlist.spotifyId && (
                            <a 
                              href={`https://open.spotify.com/playlist/${playlist.spotifyId}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                            >
                              <span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>
                              OPEN IN SPOTIFY
                            </a>
                          )}
                          {youtubeConnected && playlist.youtubeId && (
                            <a 
                              href={`https://www.youtube.com/playlist?list=${playlist.youtubeId}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                            >
                              <span className="inline-block w-2 h-2 bg-green-500 mr-2"></span>
                              OPEN IN YOUTUBE
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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