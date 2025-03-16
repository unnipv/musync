import { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import GoogleProvider from "next-auth/providers/google";
import mongoose from "mongoose";
import User from "@/models/User";
import { connectToDatabase } from './mongodb';
import { Session } from "next-auth";
import logger from './logger';

// Extend the Session type to include our custom properties
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      spotifyAccessToken?: string;
      googleAccessToken?: string;
    };
    accessToken?: string;
    provider?: string;
    dbConnectionError?: boolean;
  }
}

// Extend the global namespace to store session info
declare global {
  // eslint-disable-next-line no-var
  var sessionFlags: Record<string, boolean>;
}

// Initialize global session flags object if it doesn't exist
global.sessionFlags = global.sessionFlags || {};

/**
 * Helper function to refresh a Spotify token
 * 
 * @param token - The current token object
 * @returns The updated token with refreshed access token
 */
async function refreshSpotifyAccessToken(token: any) {
  try {
    logger.info('Refreshing Spotify access token...');
    
    // Log refresh token details (partial for security)
    if (token.spotifyRefreshToken) {
      const tokenPreview = token.spotifyRefreshToken.substring(0, 5) + '...' + 
                         token.spotifyRefreshToken.substring(token.spotifyRefreshToken.length - 5);
      logger.debug(`Using refresh token: ${tokenPreview}`);
    } else {
      logger.error('No Spotify refresh token available!');
      return {
        ...token,
        error: 'NoSpotifyRefreshToken',
      };
    }
    
    // Create refresh token parameters
    const basicAuth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const url = 'https://accounts.spotify.com/api/token';
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', token.spotifyRefreshToken);
    
    // Make the request to refresh the token
    logger.debug('Sending request to Spotify token endpoint...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to refresh Spotify token: ${response.status} ${response.statusText}`, { errorText });
      throw new Error(`Failed to refresh Spotify token: ${response.status} - ${errorText}`);
    }
    
    const refreshedTokens = await response.json();
    logger.info('Token refreshed successfully!');
    logger.debug(`New token expires in ${refreshedTokens.expires_in} seconds`);
    
    // Calculate new expiry time
    const now = Date.now();
    const newExpiresAt = Math.floor(now / 1000 + refreshedTokens.expires_in);
    
    // Log token details (partial for security)
    if (refreshedTokens.access_token) {
      const tokenPreview = refreshedTokens.access_token.substring(0, 5) + '...' + 
                         refreshedTokens.access_token.substring(refreshedTokens.access_token.length - 5);
      logger.debug(`New access token: ${tokenPreview}`);
    }
    
    const updatedToken = {
      ...token,
      spotifyAccessToken: refreshedTokens.access_token,
      spotifyTokenExpires: newExpiresAt,
      // If a new refresh token is returned, update it as well
      ...(refreshedTokens.refresh_token && {
        spotifyRefreshToken: refreshedTokens.refresh_token,
      }),
    };
    
    logger.debug(`Token refreshed and expires at: ${new Date(newExpiresAt * 1000).toISOString()}`);
    
    return updatedToken;
  } catch (error) {
    logger.error('Error refreshing Spotify access token:', error);
    
    // Return token with error flag
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

/**
 * Helper function to refresh a Google token
 * 
 * @param token - The current token object
 * @returns The updated token with refreshed access token
 */
async function refreshGoogleAccessToken(token: any) {
  try {
    logger.info('Refreshing Google access token...');
    
    // Ensure we have a refresh token
    if (!token.googleRefreshToken) {
      logger.error('No Google refresh token available');
      return {
        ...token,
        error: 'NoGoogleRefreshToken',
      };
    }
    
    // Create refresh token parameters
    const url = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams();
    params.append('client_id', process.env.GOOGLE_CLIENT_ID as string);
    params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET as string);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', token.googleRefreshToken);
    
    // Make the request to refresh the token
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    if (!response.ok) {
      logger.error('Failed to refresh Google token:', await response.text());
      throw new Error('Failed to refresh Google token');
    }
    
    const refreshedTokens = await response.json();
    logger.info('Google token refreshed successfully');
    
    // Calculate new expiry time
    const now = Date.now();
    const newExpiresAt = Math.floor(now / 1000 + refreshedTokens.expires_in);
    
    return {
      ...token,
      googleAccessToken: refreshedTokens.access_token,
      googleTokenExpires: newExpiresAt,
      // If a new refresh token is returned, update it as well
      ...(refreshedTokens.refresh_token && {
        googleRefreshToken: refreshedTokens.refresh_token,
      }),
    };
  } catch (error) {
    logger.error('Error refreshing Google access token:', error);
    
    // Return token with error flag
    return {
      ...token,
      googleError: 'RefreshAccessTokenError',
    };
  }
}

/**
 * Helper function to handle database connection errors
 * 
 * @param error - The error object
 * @returns True if it's a MongoDB connection error
 */
function isMongoConnectionError(error: any): boolean {
  return !!(error && 
    typeof error === 'object' && 
    (error.name === 'MongoNetworkError' || 
     error.name === 'MongoServerSelectionError' || 
     error.message?.includes('SSL routines') ||
     error.message?.includes('tlsv1 alert')));
}

/**
 * Helper function to fetch user's existing tokens from database
 * 
 * @param userId - The user's ID
 * @returns Object containing existing tokens from database
 */
async function fetchExistingTokens(userId: string) {
  try {
    logger.info('Fetching existing tokens for user:', userId);
    const { db } = await connectToDatabase();
    
    // Find the user in the database
    const user = await db.collection('users').findOne({
      _id: new mongoose.Types.ObjectId(userId)
    });
    
    if (!user || !user.accounts || user.accounts.length === 0) {
      logger.info('No accounts found for user');
      return {};
    }
    
    // Extract token information from accounts
    const tokens: Record<string, any> = {};
    
    user.accounts.forEach((account: any) => {
      if (account.platform === 'spotify' && account.accessToken) {
        tokens.spotifyAccessToken = account.accessToken;
        tokens.spotifyRefreshToken = account.refreshToken;
        tokens.spotifyTokenExpires = account.expiresAt;
      } else if (account.platform === 'google' && account.accessToken) {
        tokens.googleAccessToken = account.accessToken;
        tokens.googleRefreshToken = account.refreshToken;
        tokens.googleTokenExpires = account.expiresAt;
      }
    });
    
    logger.info('Found existing tokens:', {
      hasSpotify: !!tokens.spotifyAccessToken,
      hasGoogle: !!tokens.googleAccessToken
    });
    
    return tokens;
  } catch (error) {
    logger.error('Error fetching existing tokens:', error);
    // Return empty object for tokens, but don't break the flow
    return {};
  }
}

/**
 * Configuration options for NextAuth
 * Defines authentication providers and callbacks
 */
export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID as string,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "user-read-email user-read-private playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private",
        },
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl email profile",
          prompt: "consent",
          access_type: "offline",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Connect to MongoDB
        if (mongoose.connection.readyState !== 1) {
          try {
            await mongoose.connect(process.env.MONGODB_URI as string);
          } catch (error) {
            // Check if it's a database connection error
            if (isMongoConnectionError(error)) {
              logger.warn('MongoDB connection error during sign in - proceeding with auth only:', error);
              // Allow sign-in even with database errors, user tokens will be available in JWT
              // This ensures user can still authenticate even if DB is unavailable
              return true;
            }
            // For other unexpected errors, rethrow
            throw error;
          }
        }
        
        logger.info('signIn callback - account provider:', account?.provider);
        logger.info('signIn callback - user email:', user.email);
        
        // Check if user exists
        const existingUser = await User.findOne({ email: user.email });
        
        if (existingUser) {
          logger.info('Found existing user, updating...');
          
          // Get platform-specific ID
          const platformId = profile?.id || account?.providerAccountId;
          
          // Check if this platform is already connected
          const platformExists = existingUser.accounts?.some(
            (acc: any) => acc.platform === account?.provider
          );
          
          if (platformExists) {
            logger.info(`Updating existing ${account?.provider} connection`);
            
            // Update existing platform connection
            await User.findOneAndUpdate(
              { 
                email: user.email,
                "accounts.platform": account?.provider 
              },
              { 
                $set: { 
                  name: user.name,
                  image: user.image,
                  "accounts.$.platformId": platformId,
                  "accounts.$.accessToken": account?.access_token,
                  "accounts.$.refreshToken": account?.refresh_token,
                  "accounts.$.expiresAt": account?.expires_at,
                  "accounts.$.updatedAt": new Date()
                }
              }
            );
          } else {
            logger.info(`Adding new ${account?.provider} connection to existing user`);
            
            // Add a new platform connection
            await User.findOneAndUpdate(
              { email: user.email },
              { 
                $set: { 
                  name: user.name,
                  image: user.image
                },
                $addToSet: {
                  accounts: {
                    platform: account?.provider || "unknown",
                    platformId: platformId,
                    accessToken: account?.access_token,
                    refreshToken: account?.refresh_token,
                    expiresAt: account?.expires_at,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                }
              }
            );
          }
          
          // Add the MongoDB ID to the user object
          user.id = existingUser._id.toString();
        } else {
          logger.info('Creating new user with platform connection');
          
          // Create new user
          const newUser = await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            accounts: [{
              platform: account?.provider || "unknown",
              platformId: profile?.id || account?.providerAccountId,
              accessToken: account?.access_token,
              refreshToken: account?.refresh_token,
              expiresAt: account?.expires_at,
              createdAt: new Date(),
              updatedAt: new Date()
            }]
          });
          
          // Add the MongoDB ID to the user object
          user.id = newUser._id.toString();
        }
        
        logger.info('SignIn successful, user ID:', user.id);
        return true;
      } catch (error) {
        logger.error("Error in signIn callback:", error);
        
        // For MongoDB connection errors, still allow the sign-in process
        // User will still authenticate, but data won't be saved to DB temporarily
        if (isMongoConnectionError(error)) {
          logger.warn("Database connection error - allowing sign-in to proceed with tokens only");
          
          // Add a temporary ID if missing, based on profile ID or a timestamp
          if (!user.id) {
            // Use profile.id if available, or generate a temporary ID
            user.id = String(profile?.id || account?.providerAccountId || Date.now());
          }
          
          // Allow the sign-in to proceed despite DB errors
          return true;
        }
        
        // For other errors, fail the sign-in process
        return false;
      }
    },
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        logger.info("JWT callback - initial sign in with:", account.provider);
        
        // Store the user ID in the token
        token.id = user.id;
        token.userId = user.id;
        token.provider = account.provider;
        
        // Add provider-specific tokens
        if (account.provider === 'spotify') {
          token.spotifyAccessToken = account.access_token;
          token.spotifyRefreshToken = account.refresh_token;
          token.spotifyTokenExpires = account.expires_at;
        } else if (account.provider === 'google') {
          token.googleAccessToken = account.access_token;
          token.googleRefreshToken = account.refresh_token;
          token.googleTokenExpires = account.expires_at;
        }
        
        // If the user has other connected accounts, fetch their tokens too
        if (user.id) {
          try {
            const existingTokens = await fetchExistingTokens(user.id);
            
            // For Spotify login, preserve Google tokens
            if (account.provider === 'spotify' && existingTokens.googleAccessToken) {
              token.googleAccessToken = existingTokens.googleAccessToken;
              token.googleRefreshToken = existingTokens.googleRefreshToken;
              token.googleTokenExpires = existingTokens.googleTokenExpires;
            }
            
            // For Google login, preserve Spotify tokens
            if (account.provider === 'google' && existingTokens.spotifyAccessToken) {
              token.spotifyAccessToken = existingTokens.spotifyAccessToken;
              token.spotifyRefreshToken = existingTokens.spotifyRefreshToken;
              token.spotifyTokenExpires = existingTokens.spotifyTokenExpires;
            }
          } catch (error) {
            // Don't block the sign-in process if token fetching fails
            logger.error("Error fetching existing tokens in JWT callback:", error);
          }
        }
        
        return token;
      }

      // Check if the Spotify token needs refreshing
      if (token.spotifyTokenExpires && token.spotifyRefreshToken) {
        const now = Math.floor(Date.now() / 1000);
        const shouldRefresh = now > token.spotifyTokenExpires;
        
        if (shouldRefresh) {
          logger.info('Spotify token expired, refreshing...');
          try {
            return await refreshSpotifyAccessToken(token);
          } catch (error) {
            logger.error('Error refreshing Spotify token:', error);
            // Continue with the existing token but mark it as having an error
            return {
              ...token,
              error: 'RefreshAccessTokenError',
            };
          }
        }
      }
      
      // Check if the Google token needs refreshing
      if (token.googleTokenExpires && token.googleRefreshToken) {
        const now = Math.floor(Date.now() / 1000);
        const shouldRefresh = now > token.googleTokenExpires;
        
        if (shouldRefresh) {
          logger.info('Google token expired, refreshing...');
          try {
            return await refreshGoogleAccessToken(token);
          } catch (error) {
            logger.error('Error refreshing Google token:', error);
            // Continue with the existing token but mark it as having an error
            return {
              ...token,
              googleError: 'RefreshAccessTokenError',
            };
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Log only once per user session instead of every callback
      const sessionId = token.sub || token.id || 'unknown';
      const sessionKey = `session_processed_${sessionId}`;
      
      if (!global.sessionFlags[sessionKey] && process.env.NODE_ENV === 'development') {
        logger.debug(`Initial session setup for user: ${sessionId}`);
        // Set flag to avoid repeated logs for the same session
        global.sessionFlags[sessionKey] = true;
      }
      
      // Add user ID to session with fallback to empty string to satisfy type check
      session.user = {
        ...session.user,
        id: token.id || token.userId || token.sub || ''
      };
      
      // Add provider-specific tokens to session
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      
      // Add Spotify token to session if available
      if (token.spotifyAccessToken) {
        session.user.spotifyAccessToken = token.spotifyAccessToken as string;
      }
      
      // Add Google token to session if available
      if (token.googleAccessToken) {
        session.user.googleAccessToken = token.googleAccessToken as string;
      }
      
      // Add provider information
      if (token.provider) {
        session.provider = token.provider as string;
      }
      
      // Add database connection status for UI handling
      if (token.dbConnectionError) {
        session.dbConnectionError = true;
      }
      
      return session;
    },
    redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    }
  },
  debug: process.env.NODE_ENV === "development",
}; 