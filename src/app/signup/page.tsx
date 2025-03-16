'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

/**
 * Signup page component that allows users to create a new account
 * Provides options for email registration and OAuth with Spotify/Google
 * 
 * @returns The signup page component
 */
export default function SignupPage() {
  const router = useRouter()
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  /**
   * Handles form submission for email/password registration
   * 
   * @param e - The form event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Register the user
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }
      
      setSuccess('Account created successfully! Redirecting to login...')
      
      // Redirect to login after successful registration
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      console.error('Signup error:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  /**
   * Handles OAuth signup with specified provider
   * 
   * @param provider - The OAuth provider (spotify or google)
   */
  const handleOAuthSignup = (provider: string) => {
    signIn(provider, { callbackUrl: '/playlists' })
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-500 mb-6 font-vt323 text-center crt-text">
        SIGN UP
      </h1>
      
      <div className="max-w-md mx-auto bg-black border-2 border-green-500 p-6 rounded-lg shadow-[0_0_15px_#00ff00] crt-panel">
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 text-green-100 border border-red-500 rounded font-vt323 crt-error">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-900/50 text-green-100 border border-green-500 rounded font-vt323 crt-success">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label htmlFor="name" className="block text-green-500 font-vt323 mb-1">
              NAME
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border-2 border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:shadow-[0_0_10px_#00ff00] font-vt323 crt-input"
              required
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-green-500 font-vt323 mb-1">
              EMAIL
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
              PASSWORD
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
          
          <div>
            <label htmlFor="confirmPassword" className="block text-green-500 font-vt323 mb-1">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-black border-2 border-green-500 text-green-400 p-2 rounded-md focus:outline-none focus:shadow-[0_0_10px_#00ff00] font-vt323 crt-input"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-500 text-black font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 font-vt323 shadow-[0_0_10px_#00ff00] crt-glow"
          >
            {isLoading ? 'SIGNING UP...' : 'SIGN UP'}
          </button>
        </form>
        
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-green-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-black text-green-500 font-vt323">OR SIGN UP WITH</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleOAuthSignup('spotify')}
            className="flex items-center justify-center bg-black border-2 border-green-500 text-green-500 font-bold py-2 px-4 rounded-md transition-colors hover:bg-green-900/20 font-vt323 shadow-[0_0_10px_#00ff00] crt-glow"
          >
            SPOTIFY
          </button>
          
          <button
            onClick={() => handleOAuthSignup('google')}
            className="flex items-center justify-center bg-black border-2 border-green-500 text-green-500 font-bold py-2 px-4 rounded-md transition-colors hover:bg-green-900/20 font-vt323 shadow-[0_0_10px_#00ff00] crt-glow"
          >
            GOOGLE
          </button>
        </div>
        
        <p className="text-center text-green-500 font-vt323">
          ALREADY HAVE AN ACCOUNT?{' '}
          <Link href="/login" className="text-green-400 hover:text-green-300 underline crt-link">
            LOGIN
          </Link>
        </p>
      </div>
    </div>
  )
} 