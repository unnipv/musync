declare module 'spotify-web-api-node' {
  export interface SpotifyApiOptions {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
  }

  export default class SpotifyWebApi {
    constructor(options?: SpotifyApiOptions);
    setAccessToken(accessToken: string): void;
    setRefreshToken(refreshToken: string): void;
    refreshAccessToken(): Promise<any>;
    getMe(): Promise<any>;
    getUserPlaylists(userId?: string): Promise<any>;
    getPlaylist(playlistId: string): Promise<any>;
    getPlaylistTracks(playlistId: string, options?: any): Promise<any>;
    createPlaylist(userId: string, options: any): Promise<any>;
    changePlaylistDetails(playlistId: string, options: any): Promise<any>;
    addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<any>;
    removeTracksFromPlaylist(playlistId: string, tracks: any[]): Promise<any>;
    searchTracks(query: string): Promise<any>;
  }
} 