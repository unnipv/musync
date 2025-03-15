'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

/**
 * Navbar component that displays navigation links and user authentication status
 * Includes a logout button for authenticated users
 * Styled to match the retro/CRT theme of the application
 */
const Navbar = () => {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  /**
   * Handles user logout
   * Signs out the user and redirects to the home page
   */
  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  return (
    <nav className="bg-crt-bg border-b-2 border-phosphor text-phosphor p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold phosphor-text">
          Musync
        </Link>
        
        <div className="flex items-center space-x-6">
          <Link href="/playlists" className="hover:text-phosphor-light transition">
            Playlists
          </Link>
          
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <Link href="/profile" className="flex items-center space-x-2 hover:text-phosphor-light transition">
                {session?.user?.image ? (
                  <div className="border-2 border-phosphor rounded-full">
                    <Image 
                      src={session.user.image} 
                      alt={session.user.name || 'User'} 
                      width={32} 
                      height={32} 
                      className="rounded-full"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-phosphor-dark border-2 border-phosphor rounded-full flex items-center justify-center">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <span>{session?.user?.name}</span>
              </Link>
              
              <button 
                onClick={handleLogout}
                className="pixel-button"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link 
              href="/api/auth/signin"
              className="pixel-button"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 