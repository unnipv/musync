/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['i.scdn.co', 'mosaic.scdn.co', 'i.ytimg.com', 'lh3.googleusercontent.com'], // Allow images from Spotify, YouTube, and Google
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
  // Fix for punycode deprecation warning
  webpack: (config, { isServer }) => {
    // Apply punycode fix for both client and server
    config.resolve.fallback = {
      ...config.resolve.fallback,
      punycode: false, // This will remove the punycode dependency warning
      encoding: require.resolve('encoding'), // Fix for node-fetch encoding warning
    };
    
    // Explicitly handle punycode in all build configurations
    if (config.resolve.alias) {
      config.resolve.alias.punycode = false;
    } else {
      config.resolve.alias = { punycode: false };
    }
    
    // Add punycode to ignored modules
    if (!config.ignoreWarnings) {
      config.ignoreWarnings = [];
    }
    config.ignoreWarnings.push({
      module: /punycode/,
    });
    
    return config;
  },
}

module.exports = nextConfig 