'use client'

import { useState } from 'react'

/**
 * Search page component that allows users to search for tracks across platforms
 * Displays unified search results from multiple platforms
 * 
 * @returns {JSX.Element} The search page component
 */
export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)
    // In a real implementation, this would call an API to search for tracks
    setTimeout(() => {
      setIsSearching(false)
    }, 1000)
  }
  
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-pixel phosphor-text mb-8">SEARCH</h1>
      
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for tracks..."
            className="retro-input flex-grow"
          />
          <button 
            type="submit" 
            className="pixel-button"
            disabled={isSearching}
          >
            {isSearching ? 'SEARCHING...' : 'SEARCH'}
          </button>
        </div>
      </form>
      
      <div className="mb-6">
        <div className="flex space-x-4">
          <button className="pixel-button">ALL</button>
          <button className="pixel-button">SPOTIFY</button>
          <button className="pixel-button">YOUTUBE</button>
        </div>
      </div>
      
      <div className="border border-phosphor p-4 mb-8">
        <h2 className="text-2xl font-pixel phosphor-text mb-4">SEARCH RESULTS</h2>
        
        {searchQuery ? (
          <div className="space-y-4">
            {/* Placeholder search results */}
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="border border-phosphor p-4 flex justify-between items-center">
                <div>
                  <p className="font-retro text-xl phosphor-text">Track {index + 1}</p>
                  <p className="font-retro text-sm">Artist {index + 1}</p>
                  <div className="flex space-x-2 mt-2">
                    <span className="px-2 py-1 bg-phosphor-dark text-phosphor text-xs font-retro">
                      {index % 2 === 0 ? 'SPOTIFY' : 'YOUTUBE'}
                    </span>
                  </div>
                </div>
                <button className="pixel-button">ADD TO PLAYLIST</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-retro text-center py-8">ENTER A SEARCH QUERY TO FIND TRACKS</p>
        )}
      </div>
    </main>
  )
} 