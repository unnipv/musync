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
        throw new Error(data.message || 'Registration failed')
      }
      
      setSuccess('Account created successfully! Logging you in...')
      
      // Sign in the user after successful registration
      setTimeout(async () => {
        await signIn('credentials', {
          redirect: true,
          email,
          password,
          callbackUrl: '/',
        })
      }, 1500)
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }
  
  /**
   * Handles OAuth signup with a provider
   * 
   * @param provider - The OAuth provider (spotify or google)
   */
  const handleOAuthSignup = (provider: string) => {
    setIsLoading(true)
    signIn(provider, { callbackUrl: '/' })
  }
  
  return (
    <main className="container mx-auto px-4 py-8 flex flex-col items-center">
      <h1 className="text-4xl font-pixel phosphor-text mb-8">SIGN UP</h1>
      
      <div className="w-full max-w-md border border-phosphor p-6">
        {error && (
          <div className="bg-red-500 text-white p-4 rounded font-retro mb-6">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-500 text-white p-4 rounded font-retro mb-6">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block font-retro text-sm mb-2">NAME</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="retro-input w-full"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block font-retro text-sm mb-2">EMAIL</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="retro-input w-full"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block font-retro text-sm mb-2">PASSWORD</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="retro-input w-full"
            />
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block font-retro text-sm mb-2">CONFIRM PASSWORD</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="retro-input w-full"
            />
          </div>
          
          <button 
            type="submit" 
            className="pixel-button w-full"
            disabled={isLoading}
          >
            {isLoading ? 'CREATING ACCOUNT...' : 'SIGN UP'}
          </button>
        </form>
        
        <div className="mt-8">
          <p className="font-retro text-center mb-4">OR SIGN UP WITH</p>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleOAuthSignup('spotify')} 
              className="pixel-button w-full"
              disabled={isLoading}
            >
              SPOTIFY
            </button>
            <button 
              onClick={() => handleOAuthSignup('google')} 
              className="pixel-button w-full"
              disabled={isLoading}
            >
              GOOGLE
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="font-retro">
            ALREADY HAVE AN ACCOUNT?{' '}
            <Link href="/login" className="phosphor-text hover:underline">
              LOGIN
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
} 