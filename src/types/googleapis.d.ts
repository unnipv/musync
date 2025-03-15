declare module 'googleapis' {
  export const google: any;
  
  export namespace youtube_v3 {
    export interface Schema$PlaylistItemListResponse {
      data: {
        items?: any[];
        nextPageToken?: string;
      };
    }
    
    export interface Youtube {
      playlists: {
        list(params: any): Promise<any>;
        insert(params: any): Promise<any>;
        update(params: any): Promise<any>;
      };
      playlistItems: {
        list(params: any): Promise<Schema$PlaylistItemListResponse>;
        insert(params: any): Promise<any>;
        delete(params: any): Promise<any>;
      };
      search: {
        list(params: any): Promise<any>;
      };
      videos: {
        list(params: any): Promise<any>;
      };
      channels: {
        list(params: any): Promise<any>;
      };
    }
  }
} 