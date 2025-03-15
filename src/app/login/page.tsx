'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

/**
 * Login page component
 * 
 * @returns The login page
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  /**
   * Handles the credential login form submission
   * 
   * @param e - The form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const result = await signIn('credentials', {
        redirect: true,
        callbackUrl: '/playlists',
        email,
        password
      })
      
      if (result?.error) {
        setError('Invalid email or password')
        setIsLoading(false)
        return
      }
      
      // The redirect: true should handle this, but as a fallback:
      router.push('/playlists')
    } catch (error) {
      setError('An error occurred during login')
      console.error('Login error:', error)
      setIsLoading(false)
    }
  }
  
  /**
   * Handles the Spotify login
   */
  const handleSpotifyLogin = (e: React.MouseEvent) => {
    e.preventDefault()
    signIn('spotify', { 
      callbackUrl: '/playlists',
      redirect: true
    })
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-green-500 mb-6 text-center font-vt323 crt-text">
          Login to Musync
        </h1>
        
        <div className="bg-black p-6 rounded-lg border-2 border-green-500 shadow-[0_0_15px_#00ff00] crt-panel">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 text-green-100 rounded border border-red-500 font-vt323 crt-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="email" className="block text-green-500 font-vt323 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border-2 border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:shadow-[0_0_10px_#00ff00] font-vt323 crt-input"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-green-500 font-vt323 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border-2 border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:shadow-[0_0_10px_#00ff00] font-vt323 crt-input"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-500 text-black font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 font-vt323 shadow-[0_0_10px_#00ff00] crt-glow"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-green-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-black text-green-500 font-vt323">Or</span>
            </div>
          </div>
          
          <button
            onClick={handleSpotifyLogin}
            className="w-full flex items-center justify-center bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-2 px-4 rounded-md transition-colors mb-4 font-vt323 shadow-[0_0_10px_#1DB954] crt-glow-spotify"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Login with Spotify
          </button>
          
          <p className="text-center text-green-500 font-vt323">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-green-400 hover:text-green-300 underline crt-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
} 