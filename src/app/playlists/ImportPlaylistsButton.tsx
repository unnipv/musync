'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Button component that opens a modal to import playlists from connected services
 * 
 * @returns The import playlists button component
 */
export default function ImportPlaylistsButton() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<Record<string, string>>({})

  /**
   * Opens the import modal and fetches playlists from Spotify
   */
  const handleOpenModal = async () => {
    setIsModalOpen(true)
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch Spotify playlists
      const response = await fetch('/api/import/spotify')
      const data = await response.json()
      
      if (data.success) {
        setSpotifyPlaylists(data.playlists || [])
      } else {
        setError(data.message || 'Failed to fetch Spotify playlists')
      }
    } catch (err) {
      setError('An error occurred while fetching playlists')
      console.error('Fetch playlists error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Closes the import modal
   */
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSpotifyPlaylists([])
    setError(null)
    setImportStatus({})
  }

  /**
   * Imports a playlist from Spotify
   * 
   * @param playlistId - The Spotify playlist ID
   */
  const handleImportPlaylist = async (playlistId: string) => {
    setImportStatus(prev => ({ ...prev, [playlistId]: 'importing' }))
    
    try {
      const response = await fetch('/api/import/spotify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spotifyPlaylistId: playlistId }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setImportStatus(prev => ({ ...prev, [playlistId]: 'success' }))
      } else {
        setImportStatus(prev => ({ ...prev, [playlistId]: 'error' }))
      }
    } catch (err) {
      setImportStatus(prev => ({ ...prev, [playlistId]: 'error' }))
      console.error('Import playlist error:', err)
    }
  }

  /**
   * Refreshes the playlists page after importing
   */
  const handleDone = () => {
    handleCloseModal()
    router.refresh()
  }

  return (
    <>
      <button 
        onClick={handleOpenModal}
        className="pixel-button"
      >
        IMPORT PLAYLISTS
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-phosphor p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-pixel phosphor-text mb-6">IMPORT PLAYLISTS</h2>
            
            {error && (
              <div className="bg-red-500 text-white p-4 rounded font-retro mb-6">
                {error}
              </div>
            )}
            
            {isLoading ? (
              <p className="font-retro text-center py-8">Loading playlists...</p>
            ) : (
              <>
                {spotifyPlaylists.length > 0 ? (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-retro text-xl phosphor-text mb-2">SPOTIFY PLAYLISTS</h3>
                    {spotifyPlaylists.map((playlist) => (
                      <div 
                        key={playlist.id} 
                        className="border border-phosphor p-4 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-retro text-lg">{playlist.name}</p>
                          <p className="font-retro text-sm">{playlist.tracks?.total || 0} tracks</p>
                        </div>
                        
                        {importStatus[playlist.id] === 'importing' ? (
                          <span className="font-retro">IMPORTING...</span>
                        ) : importStatus[playlist.id] === 'success' ? (
                          <span className="font-retro text-green-500">IMPORTED</span>
                        ) : importStatus[playlist.id] === 'error' ? (
                          <span className="font-retro text-red-500">FAILED</span>
                        ) : (
                          <button 
                            onClick={() => handleImportPlaylist(playlist.id)}
                            className="pixel-button"
                          >
                            IMPORT
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-retro text-center py-4">No Spotify playlists found</p>
                )}
              </>
            )}
            
            <div className="flex justify-end space-x-4 mt-6">
              <button 
                onClick={handleCloseModal}
                className="pixel-button"
              >
                CANCEL
              </button>
              <button 
                onClick={handleDone}
                className="pixel-button"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 