import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Mark route as dynamic since it uses headers and session
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Validates the access token for a specified provider
 * 
 * @param req - The incoming request with provider query parameter
 * @returns API response indicating token validity
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { valid: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get provider from query
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    
    if (!provider || (provider !== 'spotify' && provider !== 'google')) {
      return NextResponse.json(
        { valid: false, error: 'Invalid provider specified' },
        { status: 400 }
      );
    }
    
    // Check if token exists
    if (provider === 'spotify' && !session.user.spotifyAccessToken) {
      return NextResponse.json({ valid: false, reason: 'no_token' });
    }
    
    if (provider === 'google' && !session.user.googleAccessToken) {
      return NextResponse.json({ valid: false, reason: 'no_token' });
    }
    
    // Validate token by making a simple API call
    if (provider === 'spotify') {
      try {
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            'Authorization': `Bearer ${session.user.spotifyAccessToken}`
          }
        });
        
        if (!response.ok) {
          return NextResponse.json({ 
            valid: false, 
            reason: 'api_error', 
            status: response.status 
          });
        }
        
        return NextResponse.json({ valid: true });
      } catch (error) {
        console.error('Error validating Spotify token:', error);
        return NextResponse.json({ valid: false, reason: 'exception' });
      }
    } else if (provider === 'google') {
      try {
        // For YouTube, first check the token with userinfo endpoint (simpler)
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            'Authorization': `Bearer ${session.user.googleAccessToken}`
          }
        });
        
        // If basic auth works but we need to check YouTube-specific permissions
        if (userInfoResponse.ok) {
          console.log('Google token basic validation successful, checking YouTube permissions...');
          
          // Now test YouTube API specific access
          const youtubeResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
            headers: {
              'Authorization': `Bearer ${session.user.googleAccessToken}`
            }
          });
          
          if (!youtubeResponse.ok) {
            // Try getting text content for better error info
            let errorText = '';
            try {
              errorText = await youtubeResponse.text();
            } catch (e) {
              console.warn('Could not extract error text from response');
            }
            
            console.log(`Google token YouTube validation failed: ${youtubeResponse.status}, ${errorText}`);
            
            // If auth is good but YouTube specific permission is missing
            if (youtubeResponse.status === 403) {
              return NextResponse.json({ 
                valid: false, 
                reason: 'permission_error',
                status: youtubeResponse.status,
                error: errorText,
                message: 'Missing YouTube API permissions. Please reconnect with YouTube permissions.'
              });
            }
            
            return NextResponse.json({ 
              valid: false, 
              reason: 'api_error', 
              status: youtubeResponse.status,
              error: errorText
            });
          }
          
          return NextResponse.json({ valid: true });
        } else {
          // Basic auth failed, token is invalid
          let errorText = '';
          try {
            errorText = await userInfoResponse.text();
          } catch (e) {
            console.warn('Could not extract error text from userinfo response');
          }
          
          console.log(`Google token basic validation failed: ${userInfoResponse.status}, ${errorText}`);
          
          return NextResponse.json({ 
            valid: false, 
            reason: 'token_invalid', 
            status: userInfoResponse.status,
            error: errorText
          });
        }
      } catch (error) {
        console.error('Error validating Google token:', error);
        return NextResponse.json({ 
          valid: false, 
          reason: 'exception', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return NextResponse.json({ valid: false, reason: 'unknown' });
  } catch (error) {
    console.error('Unexpected error in token validation:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}