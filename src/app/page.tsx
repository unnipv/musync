'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link'
import Image from 'next/image'

/**
 * Home page component
 * Displays a welcome message and call-to-action based on authentication status
 */
export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto bg-black border-2 border-green-500 p-8 rounded-lg shadow-[0_0_15px_#00ff00] crt-panel">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-green-500 mb-6 font-vt323 crt-text">
            Welcome to Musync
          </h1>
          
          <p className="text-green-400 text-xl mb-8 font-vt323">
            Sync and manage your music playlists across different platforms
          </p>
          
          {isAuthenticated ? (
            <div className="space-y-6">
              <p className="text-green-300 font-vt323">
                Hello, {session?.user?.name}! Ready to manage your music?
              </p>
              
              <div className="flex justify-center space-x-4">
                <Link 
                  href="/playlists" 
                  className="bg-black border-2 border-green-500 text-green-500 hover:bg-green-900/20 font-bold px-6 py-2 rounded font-vt323 transition-colors shadow-[0_0_10px_#00ff00]"
                >
                  My Playlists
                </Link>
                <Link 
                  href="/profile" 
                  className="bg-black border-2 border-green-500 text-green-500 hover:bg-green-900/20 font-bold px-6 py-2 rounded font-vt323 transition-colors shadow-[0_0_10px_#00ff00]"
                >
                  My Profile
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-green-300 font-vt323">
                Sync and manage your music playlists across different platforms
              </p>
              
              <Link 
                href="/login" 
                className="inline-block bg-green-600 hover:bg-green-500 text-black font-bold py-2 px-6 rounded font-vt323 transition-colors shadow-[0_0_10px_#00ff00] crt-glow"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 