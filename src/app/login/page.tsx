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
   * Handles OAuth login with the specified provider
   * 
   * @param provider - The provider to use for OAuth login (e.g., 'spotify', 'google')
   */
  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { 
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
          
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('spotify')}
              className="w-full flex items-center justify-center bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-2 px-4 rounded-md transition-colors mb-4 font-vt323 shadow-[0_0_10px_#1DB954] crt-glow-spotify"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Login with Spotify
            </button>
            
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center bg-black border-2 border-green-500 text-green-500 font-bold py-2 px-4 rounded-md transition-colors hover:bg-green-900/20 font-vt323 shadow-[0_0_10px_#00ff00] crt-glow"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
              Login with Google
            </button>
          </div>
          
          <p className="text-center text-green-500 font-vt323 mt-6">
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