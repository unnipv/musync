'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';

/**
 * Test page component that displays authentication and playlist information
 * This helps verify that the application is working correctly
 * 
 * @returns The test page component
 */
export default function TestPage() {
  const { data: session, status } = useSession();
  const [authTest, setAuthTest] = useState<any>(null);
  const [playlistTest, setPlaylistTest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Fetches test data from the API
   */
  const fetchTestData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Test authentication
      const authResponse = await fetch('/api/auth/test');
      const authData = await authResponse.json();
      setAuthTest(authData);
      
      // Test playlists if authenticated
      if (authData.authenticated) {
        const playlistResponse = await fetch('/api/playlists/test');
        const playlistData = await playlistResponse.json();
        setPlaylistTest(playlistData);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch test data when session changes
  useEffect(() => {
    if (status !== 'loading') {
      fetchTestData();
    }
  }, [status]);
  
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-pixel phosphor-text mb-8">TEST PAGE</h1>
      
      <div className="mb-8">
        <Link href="/" className="pixel-button">
          BACK TO HOME
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-500 text-white p-4 rounded font-retro mb-6">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="border border-phosphor p-6">
          <h2 className="text-2xl font-pixel phosphor-text mb-4">AUTHENTICATION</h2>
          
          <div className="mb-4">
            <p className="font-retro mb-2">
              Status: <span className="phosphor-text">{status}</span>
            </p>
            
            {session ? (
              <div>
                <p className="font-retro mb-2">
                  Logged in as: <span className="phosphor-text">{session.user.email}</span>
                </p>
                <button 
                  onClick={() => signOut()} 
                  className="pixel-button mt-4"
                >
                  SIGN OUT
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button 
                  onClick={() => signIn('spotify')} 
                  className="pixel-button"
                >
                  SPOTIFY LOGIN
                </button>
                <button 
                  onClick={() => signIn('google')} 
                  className="pixel-button"
                >
                  GOOGLE LOGIN
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-6">
            <h3 className="text-xl font-pixel phosphor-text mb-2">API TEST RESULT</h3>
            {isLoading ? (
              <p className="font-retro">Loading...</p>
            ) : authTest ? (
              <pre className="bg-phosphor-dark p-4 overflow-auto text-sm font-retro">
                {JSON.stringify(authTest, null, 2)}
              </pre>
            ) : (
              <p className="font-retro">No data</p>
            )}
          </div>
        </div>
        
        <div className="border border-phosphor p-6">
          <h2 className="text-2xl font-pixel phosphor-text mb-4">PLAYLISTS</h2>
          
          {session ? (
            <div>
              <div className="mb-4">
                <Link href="/playlists" className="pixel-button">
                  VIEW PLAYLISTS
                </Link>
              </div>
              
              <div className="mt-6">
                <h3 className="text-xl font-pixel phosphor-text mb-2">API TEST RESULT</h3>
                {isLoading ? (
                  <p className="font-retro">Loading...</p>
                ) : playlistTest ? (
                  <pre className="bg-phosphor-dark p-4 overflow-auto text-sm font-retro">
                    {JSON.stringify(playlistTest, null, 2)}
                  </pre>
                ) : (
                  <p className="font-retro">No data</p>
                )}
              </div>
            </div>
          ) : (
            <p className="font-retro">Please log in to test playlist functionality</p>
          )}
        </div>
      </div>
      
      <div className="mt-8 border border-phosphor p-6">
        <h2 className="text-2xl font-pixel phosphor-text mb-4">NEXT STEPS</h2>
        
        <ul className="list-disc list-inside font-retro space-y-2">
          <li>Test playlist creation, updating, and deletion</li>
          <li>Test importing playlists from Spotify and YouTube</li>
          <li>Test synchronization between platforms</li>
          <li>Implement search functionality</li>
          <li>Add user profile management</li>
          <li>Optimize performance with caching and pagination</li>
          <li>Write unit and integration tests</li>
        </ul>
      </div>
    </main>
  );
} 