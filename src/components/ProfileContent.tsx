'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';

/**
 * Interface for the profile data structure
 */
interface ProfileData {
  name: string;
  email: string;
  image?: string;
  platforms?: {
    name: string;
    userId: string;
    lastSyncedAt: string | null;
  }[];
  playlists: {
    _id: string;
    name: string;
    description: string;
    trackCount: number;
  }[];
}

/**
 * Component for displaying user profile content
 * 
 * @param props - Component props containing the user ID
 * @returns The profile content component
 */
export default function ProfileContent({ userId }: { userId: string }) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/profile');
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load profile');
        }
        
        const data = await response.json();
        console.log('Profile data:', data); // Add logging to see the actual data structure
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError(error instanceof Error ? error.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [userId]);
  
  /**
   * Connects to Spotify
   */
  const connectToSpotify = () => {
    setIsConnecting(true);
    signIn('spotify', { callbackUrl: '/profile' });
  };

  /**
   * Connects to YouTube
   */
  const connectToYouTube = () => {
    // This would be implemented when YouTube integration is ready
    alert('YouTube integration coming soon!');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-green-500 font-vt323">
        <div className="text-2xl animate-pulse crt-text">Loading profile data...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500 p-4 rounded-md text-green-100 font-vt323 crt-error">
        <h3 className="text-xl font-bold mb-2">Error Loading Profile</h3>
        <p>{error}</p>
        <p className="mt-4">Try refreshing the page or logging in again.</p>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="bg-yellow-900/30 border border-yellow-500 p-4 rounded-md text-green-100 font-vt323 crt-warning">
        <h3 className="text-xl font-bold mb-2">No Profile Data</h3>
        <p>We couldn&apos;t find your profile information.</p>
        <p className="mt-4">Try logging in again.</p>
      </div>
    );
  }
  
  // Check if Spotify is connected - safely access platforms array
  const spotifyConnected = profile.platforms?.some(p => p.name === 'spotify') || false;
  // Check if YouTube is connected - safely access platforms array
  const youtubeConnected = profile.platforms?.some(p => p.name === 'youtube') || false;

  return (
    <div className="space-y-8 font-vt323 text-green-500 crt-text">
      <div className="bg-black/50 border border-green-500 p-6 rounded-md shadow-[0_0_10px_#00ff00] crt-panel">
        <h2 className="text-2xl font-bold mb-4">User Information</h2>
        <div className="space-y-2">
          <p><span className="text-green-300">Name:</span> {profile.name}</p>
          <p><span className="text-green-300">Email:</span> {profile.email}</p>
        </div>
      </div>

      <div className="bg-black/50 border border-green-500 p-6 rounded-md shadow-[0_0_10px_#00ff00] crt-panel">
        <h2 className="text-2xl font-bold mb-4">Connected Platforms</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-2 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span>Spotify</span>
            </div>
            
            {spotifyConnected ? (
              <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded-md text-sm">
                Connected
              </span>
            ) : (
              <button
                onClick={connectToSpotify}
                disabled={isConnecting}
                className="px-3 py-1 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-md text-sm transition-colors shadow-[0_0_5px_#1DB954] crt-glow-spotify disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-2 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span>YouTube</span>
            </div>
            
            {youtubeConnected ? (
              <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded-md text-sm">
                Connected
              </span>
            ) : (
              <button
                onClick={connectToYouTube}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-[0_0_5px_#ff0000] crt-glow-youtube"
              >
                Coming Soon
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-black/50 border border-green-500 p-6 rounded-md shadow-[0_0_10px_#00ff00] crt-panel">
        <h2 className="text-2xl font-bold mb-4">Your Playlists</h2>
        
        {profile.playlists && profile.playlists.length > 0 ? (
          <div className="space-y-4">
            {profile.playlists.map((playlist) => (
              <Link 
                key={playlist._id} 
                href={`/playlists/${playlist._id}`}
                className="block p-3 border border-green-700 rounded-md hover:bg-green-900/20 transition-colors"
              >
                <div className="font-bold">{playlist.name}</div>
                {playlist.description && (
                  <div className="text-green-300 text-sm mt-1">{playlist.description}</div>
                )}
                <div className="text-sm mt-2">
                  {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="mb-4">You don&apos;t have any playlists yet.</p>
            <Link 
              href="/playlists" 
              className="inline-block px-4 py-2 bg-blue-900 hover:bg-blue-800 text-green-100 rounded-md transition-colors shadow-[0_0_10px_#0066ff] crt-glow-blue"
            >
              Create a Playlist
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 