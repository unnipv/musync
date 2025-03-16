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
    <nav className="bg-black border-b-2 border-green-500 text-green-500 p-4 shadow-[0_0_10px_#00ff00]">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-green-500 font-vt323 crt-text">
          Musync
        </Link>
        
        <div className="flex items-center space-x-6">
          <Link href="/playlists" className="text-green-500 hover:text-green-400 transition font-vt323">
            Playlists
          </Link>
          
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <Link href="/profile" className="flex items-center space-x-2 text-green-500 hover:text-green-400 transition font-vt323">
                {session?.user?.image ? (
                  <div className="border-2 border-green-500 rounded-full">
                    <Image 
                      src={session.user.image} 
                      alt={session.user.name || 'User'} 
                      width={32} 
                      height={32} 
                      className="rounded-full"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-black border-2 border-green-500 rounded-full flex items-center justify-center font-vt323">
                    {session?.user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <span>{session?.user?.name}</span>
              </Link>
              
              <button 
                onClick={handleLogout}
                className="bg-black border-2 border-green-500 text-green-500 hover:bg-green-900/20 font-bold px-4 py-1 rounded font-vt323 transition-colors shadow-[0_0_5px_#00ff00]"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link 
              href="/login"
              className="bg-black border-2 border-green-500 text-green-500 hover:bg-green-900/20 font-bold px-4 py-1 rounded font-vt323 transition-colors shadow-[0_0_5px_#00ff00]"
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