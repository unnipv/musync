'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlaylistDocument, PlaylistTrack } from '@/lib/models/playlist';
import TrackList from './TrackList';

// SVG icons
const SpotifyIcon = () => (
  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const SyncIcon = ({ spinning = false }: { spinning?: boolean }) => (
  <svg 
    className={`w-4 h-4 mr-2 ${spinning ? 'animate-spin' : ''}`} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
  </svg>
);

interface PlaylistDetailProps {
  playlist: PlaylistDocument;
  isOwner: boolean;
}

/**
 * Component for displaying and managing a playlist's details
 */
export default function PlaylistDetail({ playlist, isOwner }: PlaylistDetailProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(playlist.title || playlist.name || '');
  const [description, setDescription] = useState(playlist.description || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);

  // Check if the playlist has connected platforms
  const hasSpotify = playlist.platformData?.some(p => p.platform === 'spotify');
  const hasYouTube = playlist.platformData?.some(p => p.platform === 'youtube');
  const hasConnectedPlatforms = hasSpotify || hasYouTube;

  // Get platform-specific IDs for debugging
  const spotifyData = playlist.platformData?.find(p => p.platform === 'spotify');
  const spotifyId = spotifyData?.id || spotifyData?.platformId || undefined;
  
  const youtubeData = playlist.platformData?.find(p => p.platform === 'youtube');
  const youtubeId = youtubeData?.id || youtubeData?.platformId || undefined;

  // Check for connected parameter in the URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const connectedPlatform = url.searchParams.get('connected');
    
    if (connectedPlatform) {
      setSyncMessage(`Successfully connected to ${connectedPlatform}. Your playlist will be synced soon.`);
      
      // Remove the connected parameter from the URL
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
      
      // Clear the message after 5 seconds
      const timer = setTimeout(() => {
        setSyncMessage('');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
    
    return undefined;
  }, []);

  /**
   * Handles saving playlist details
   */
  const handleSave = async () => {
    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update playlist');
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update playlist');
    }
  };

  /**
   * Handles playlist deletion
   */
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      const response = await fetch(`/api/playlists/${playlist._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete playlist');
      }

      router.push('/playlists');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete playlist');
    }
  };

  /**
   * Synchronizes the playlist with connected streaming platforms
   */
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing playlist...');
    setError(null);
    setSpotifyUrl(null);
    setYoutubeUrl(null);

    try {
      // Determine which platforms to sync with
      const platforms = [];
      if (hasSpotify) platforms.push('spotify');
      if (hasYouTube) platforms.push('youtube');

      if (platforms.length === 0) {
        setSyncMessage('No platforms connected to sync with.');
        setIsSyncing(false);
        return;
      }

      const response = await fetch(`/api/playlists/${playlist._id}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platforms }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sync playlist');
      }

      const result = await response.json();
      console.log('Sync result:', result);
      
      // Check all possible places YouTube URL might be located in the response
      if (result.youtubeUrl) {
        setYoutubeUrl(result.youtubeUrl);
      } else if (result.platformUrls?.youtube) {
        setYoutubeUrl(result.platformUrls.youtube);
      } else if (result.syncResult?.youtube?.youtubeUrl) {
        setYoutubeUrl(result.syncResult.youtube.youtubeUrl);
      } else if (result.syncResult?.youtube?.playlistUrl) {
        setYoutubeUrl(result.syncResult.youtube.playlistUrl);
      } else if (youtubeId) {
        // Fallback to constructing URL from ID if available
        setYoutubeUrl(`https://www.youtube.com/playlist?list=${youtubeId}`);
      }
      
      // Show detailed sync results
      if (result.syncResult) {
        // Check for auth errors first
        if (result.syncResult.spotify?.spotifyAuthError) {
          setError(`Spotify authentication error: ${result.syncResult.spotify.message || 'Please reconnect your Spotify account.'}`);
          setSyncMessage('');
          return; // Exit early
        }
        
        // Build a comprehensive sync message
        let syncMessageText = '';
        
        // Check Spotify sync status
        if (result.syncResult.spotify) {
          const spotifyResult = result.syncResult.spotify;
          syncMessageText += `Spotify sync ${spotifyResult.status || 'success'}: ${spotifyResult.message || 'Synchronized with Spotify'}`;
          
          // Set Spotify URL if available
          if (spotifyResult.spotifyUrl) {
            setSpotifyUrl(spotifyResult.spotifyUrl);
          } else if (result.spotifyUrl) {
            setSpotifyUrl(result.spotifyUrl);
          } else if (result.platformUrls?.spotify) {
            setSpotifyUrl(result.platformUrls.spotify);
          } else if (spotifyId) {
            // Fallback to constructing URL from ID
            setSpotifyUrl(`https://open.spotify.com/playlist/${spotifyId}`);
          }
        }
        
        // Check YouTube sync status
        if (result.syncResult.youtube) {
          const youtubeResult = result.syncResult.youtube;
          
          // Add a separator if we already have Spotify info
          if (syncMessageText) {
            syncMessageText += ' | ';
          }
          
          syncMessageText += `YouTube sync ${youtubeResult.status || 'success'}: ${youtubeResult.message || 'Synchronized with YouTube'}`;
        }
        
        // If we have any sync info, set the message
        if (syncMessageText) {
          setSyncMessage(syncMessageText);
        } else {
          // Fallback generic message
          setSyncMessage('Playlist synced successfully!');
        }
      } else {
        // Fallback for older API format
        setSyncMessage('Playlist synced successfully!');
      }
      
      setTimeout(() => {
        router.refresh();
      }, 5000);
    } catch (error) {
      console.error('Error syncing playlist:', error);
      setError(`Failed to sync playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSyncMessage('');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-[0_0_15px_#00ff00] crt-panel">
      <div className="flex justify-between items-center mb-6">
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-black border border-green-500 text-green-500 text-2xl font-bold p-2 w-full font-vt323"
          />
        ) : (
          <h1 className="text-3xl font-bold text-green-500 font-vt323">{title}</h1>
        )}

        <div className="flex space-x-3 items-center">
          {hasSpotify && <SpotifyIcon />}
          {hasYouTube && <YouTubeIcon />}

          {isOwner && hasConnectedPlatforms && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center bg-green-800 hover:bg-green-700 text-green-100 px-3 py-1 rounded-md transition-colors disabled:opacity-50 font-vt323"
            >
              <SyncIcon spinning={isSyncing} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          )}
        </div>
      </div>

      {syncMessage && (
        <div className="mb-4 p-2 bg-green-900 text-green-100 rounded font-vt323">
          {syncMessage}
          <div className="mt-2 flex flex-wrap gap-2">
            {spotifyUrl && (
              <a 
                href={spotifyUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-md transition-colors"
              >
                <SpotifyIcon />
                <span className="ml-2">Open in Spotify</span>
              </a>
            )}
            {youtubeUrl && (
              <a 
                href={youtubeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded-md transition-colors"
              >
                <YouTubeIcon />
                <span className="ml-2">Open in YouTube</span>
              </a>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 bg-red-900 text-red-100 rounded font-vt323">
          {error}
          {error.includes('Spotify authentication') && (
            <div className="mt-3">
              <a 
                href={`/api/auth/signin/spotify?callbackUrl=${encodeURIComponent(window.location.href)}`}
                className="inline-flex items-center bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-md transition-colors"
              >
                <SpotifyIcon />
                <span className="ml-2">Reconnect Spotify</span>
              </a>
            </div>
          )}
        </div>
      )}

      {isOwner && hasSpotify && (
        <div className="mb-4 p-2 bg-gray-800 text-green-300 rounded font-vt323 text-sm">
          <p>Spotify Playlist ID: {spotifyId}</p>
        </div>
      )}

      {isEditing ? (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-black border border-green-500 text-green-500 p-2 w-full mb-4 font-vt323"
          rows={3}
        />
      ) : (
        <p className="text-green-400 mb-4 font-vt323">{description || 'No description'}</p>
      )}

      {isOwner && (
        <div className="flex space-x-4 mb-6">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded-md transition-colors font-vt323"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-800 hover:bg-gray-700 text-green-500 px-4 py-2 rounded-md transition-colors font-vt323"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded-md transition-colors font-vt323"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-900 hover:bg-red-800 text-green-100 px-4 py-2 rounded-md transition-colors font-vt323"
              >
                Delete
              </button>

              {!hasConnectedPlatforms && (
                <button
                  onClick={() => router.push(`/playlists/${playlist._id}/connect`)}
                  className="bg-blue-900 hover:bg-blue-800 text-green-100 px-4 py-2 rounded-md transition-colors font-vt323"
                >
                  Connect to Platforms
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-green-500 mb-4 font-vt323">Tracks</h2>
        <TrackList
          tracks={playlist.tracks}
          playlistId={playlist._id.toString()}
          isOwner={isOwner}
        />
      </div>

      {isOwner && (
        <div>
          <h2 className="text-xl font-bold text-green-500 mb-4 font-vt323">Add Track</h2>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Enter Spotify or YouTube URL"
              className="flex-1 bg-black border border-green-500 text-green-500 p-2 rounded font-vt323"
            />
            <button
              className="bg-green-600 hover:bg-green-500 text-black px-4 py-2 rounded transition-colors font-vt323"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 