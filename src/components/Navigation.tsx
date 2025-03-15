import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Navigation component that provides the main navigation menu for the application
 * Displays links to Home, Playlists, Profile, and Search pages
 * Highlights the current active page
 * 
 * @returns {JSX.Element} The navigation component
 */
export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { name: 'HOME', path: '/' },
    { name: 'PLAYLISTS', path: '/playlists' },
    { name: 'PROFILE', path: '/profile' },
    { name: 'SEARCH', path: '/search' },
  ]

  return (
    <nav className="border-b border-phosphor py-4">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="font-pixel text-2xl phosphor-text">
            MUSYNC
          </Link>
          
          <div className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`font-retro text-lg ${
                  pathname === item.path
                    ? 'phosphor-text'
                    : 'text-phosphor hover:phosphor-text'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
          
          <div className="md:hidden">
            <button className="pixel-button">MENU</button>
          </div>
        </div>
      </div>
    </nav>
  )
} 