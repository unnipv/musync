import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth/next';
import Playlist from '@/lib/models/playlist';

// Mock dependencies
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/mongoose', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/models/playlist', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    create: jest.fn(),
  },
}));

describe('Playlist API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('GET', () => {
    /**
     * Test getting playlists when authenticated
     */
    it('should return playlists when authenticated', async () => {
      // Mock authenticated session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user123' },
      });
      
      // Mock playlist data
      const mockPlaylists = [
        { _id: 'playlist1', name: 'Playlist 1' },
        { _id: 'playlist2', name: 'Playlist 2' },
      ];
      
      (Playlist.find as jest.Mock).mockResolvedValue(mockPlaylists);
      
      // Create a mock NextRequest
      const mockRequest = new NextRequest(new URL('http://localhost:3000/api/playlists'));
      
      // Pass the mock request to GET
      const response = await GET(mockRequest);
      const data = await response.json();
      
      expect(getServerSession).toHaveBeenCalled();
      expect(Playlist.find).toHaveBeenCalledWith({ userId: 'user123' });
      expect(data).toEqual({
        success: true,
        playlists: mockPlaylists,
      });
    });
    
    /**
     * Test getting playlists when not authenticated
     */
    it('should return unauthorized when not authenticated', async () => {
      // Mock unauthenticated session
      (getServerSession as jest.Mock).mockResolvedValue(null);
      
      // Create a mock NextRequest
      const mockRequest = new NextRequest(new URL('http://localhost:3000/api/playlists'));
      
      // Pass the mock request to GET
      const response = await GET(mockRequest);
      const data = await response.json();
      
      expect(getServerSession).toHaveBeenCalled();
      expect(Playlist.find).not.toHaveBeenCalled();
      expect(data).toEqual({
        success: false,
        message: 'Unauthorized',
      });
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST', () => {
    /**
     * Test creating a playlist when authenticated
     */
    it('should create a playlist when authenticated', async () => {
      // Mock authenticated session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user123' },
      });
      
      // Mock request data
      const requestData = {
        name: 'New Playlist',
        description: 'A new playlist',
        isPublic: true,
      };
      
      const request = new NextRequest('http://localhost:3000/api/playlists', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
      
      // Mock created playlist
      const mockPlaylist = {
        _id: 'playlist123',
        ...requestData,
        userId: 'user123',
      };
      
      (Playlist.create as jest.Mock).mockResolvedValue(mockPlaylist);
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(getServerSession).toHaveBeenCalled();
      expect(Playlist.create).toHaveBeenCalledWith({
        name: requestData.name,
        description: requestData.description,
        userId: 'user123',
        isPublic: requestData.isPublic,
        tracks: [],
        platformData: [],
      });
      expect(data).toEqual({
        success: true,
        message: 'Playlist created successfully',
        playlist: mockPlaylist,
      });
    });
    
    /**
     * Test creating a playlist with missing name
     */
    it('should return error when name is missing', async () => {
      // Mock authenticated session
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user123' },
      });
      
      // Mock request with missing name
      const requestData = {
        description: 'A new playlist',
        isPublic: true,
      };
      
      const request = new NextRequest('http://localhost:3000/api/playlists', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(getServerSession).toHaveBeenCalled();
      expect(Playlist.create).not.toHaveBeenCalled();
      expect(data).toEqual({
        success: false,
        message: 'Playlist name is required',
      });
      expect(response.status).toBe(400);
    });
  });
}); 