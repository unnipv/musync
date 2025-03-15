/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.scdn.co', 'mosaic.scdn.co', 'i.ytimg.com'], // Allow images from Spotify and YouTube
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: process.env.DISABLE_TYPE_CHECK === 'true',
  },
  eslint: {
    // Only ignore ESLint errors during builds when explicitly disabled
    ignoreDuringBuilds: process.env.DISABLE_LINT_CHECK === 'true',
  },
}

module.exports = nextConfig 