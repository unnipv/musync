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
    <div className="min-h-screen">
      <div className="crt-container bg-crt-bg p-8 my-8 max-w-4xl mx-auto">
        <div className="scanline"></div>
        <div className="screen-curve"></div>
        
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold phosphor-text mb-6">
            Welcome to Musync
          </h1>
          
          <p className="text-phosphor text-xl mb-8">
            Sync and manage your music playlists across different platforms
          </p>
          
          {isAuthenticated ? (
            <div className="space-y-6">
              <p className="text-phosphor-light">
                Hello, {session?.user?.name}! Ready to manage your music?
              </p>
              
              <div className="flex justify-center space-x-4">
                <Link href="/playlists" className="pixel-button">
                  My Playlists
                </Link>
                <Link href="/profile" className="pixel-button">
                  My Profile
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-phosphor-light">
                Sign in with your Spotify account to get started
              </p>
              
              {/* No duplicate login button here - we'll use the one in the navbar */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 