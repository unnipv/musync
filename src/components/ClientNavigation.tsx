'use client'

import Navigation from './Navigation'

/**
 * Client component wrapper for the Navigation component
 * This is necessary because the Navigation component uses client-side hooks
 * 
 * @returns {JSX.Element} The wrapped Navigation component
 */
export default function ClientNavigation() {
  return <Navigation />
} 