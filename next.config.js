/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.scdn.co', 'mosaic.scdn.co', 'i.ytimg.com'], // Allow images from Spotify and YouTube
  },
}

module.exports = nextConfig 