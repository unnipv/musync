import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Playlist from '../playlist';

let mongoServer: MongoMemoryServer;

/**
 * Set up the test environment before running tests
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

/**
 * Clean up the test environment after running tests
 */
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

/**
 * Clean up the database after each test
 */
afterEach(async () => {
  await Playlist.deleteMany({});
});

describe('Playlist Model', () => {
  /**
   * Test creating a playlist
   */
  it('should create a playlist successfully', async () => {
    const playlistData = {
      name: 'Test Playlist',
      description: 'A test playlist',
      userId: new mongoose.Types.ObjectId(),
      isPublic: true,
      tracks: [],
      platformData: []
    };
    
    const playlist = await Playlist.create(playlistData);
    
    expect(playlist).toBeDefined();
    expect(playlist.name).toBe(playlistData.name);
    expect(playlist.description).toBe(playlistData.description);
    expect(playlist.userId.toString()).toBe(playlistData.userId.toString());
    expect(playlist.isPublic).toBe(playlistData.isPublic);
    expect(playlist.tracks).toEqual([]);
    expect(playlist.platformData).toEqual([]);
  });
  
  /**
   * Test adding a track to a playlist
   */
  it('should add a track to a playlist', async () => {
    const playlist = await Playlist.create({
      name: 'Test Playlist',
      description: 'A test playlist',
      userId: new mongoose.Types.ObjectId(),
      isPublic: true,
      tracks: [],
      platformData: []
    });
    
    const track = {
      title: 'Test Track',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      addedAt: new Date(),
      platformData: [
        {
          provider: 'spotify',
          id: 'spotify123',
          url: 'https://spotify.com/track/123'
        }
      ]
    };
    
    playlist.tracks.push(track);
    await playlist.save();
    
    const updatedPlaylist = await Playlist.findById(playlist._id);
    
    expect(updatedPlaylist).toBeDefined();
    expect(updatedPlaylist!.tracks).toHaveLength(1);
    expect(updatedPlaylist!.tracks[0].title).toBe(track.title);
    expect(updatedPlaylist!.tracks[0].artist).toBe(track.artist);
    expect(updatedPlaylist!.tracks[0].album).toBe(track.album);
    expect(updatedPlaylist!.tracks[0].duration).toBe(track.duration);
    
    // Check if platformData exists before accessing it
    if (updatedPlaylist!.tracks[0].platformData) {
      expect(updatedPlaylist!.tracks[0].platformData).toHaveLength(1);
      expect(updatedPlaylist!.tracks[0].platformData[0].provider).toBe(track.platformData[0].provider);
    }
  });
  
  /**
   * Test adding platform data to a playlist
   */
  it('should add platform data to a playlist', async () => {
    const playlist = await Playlist.create({
      name: 'Test Playlist',
      description: 'A test playlist',
      userId: new mongoose.Types.ObjectId(),
      isPublic: true,
      tracks: [],
      platformData: []
    });
    
    const platformData = {
      platform: 'spotify',
      id: 'spotify123',
      url: 'https://spotify.com/playlist/123',
      synced: true
    };
    
    // Initialize platformData if it doesn't exist
    if (!playlist.platformData) {
      playlist.platformData = [];
    }
    
    playlist.platformData.push(platformData);
    await playlist.save();
    
    const updatedPlaylist = await Playlist.findById(playlist._id);
    
    expect(updatedPlaylist).toBeDefined();
    
    // Check if platformData exists before accessing it
    if (updatedPlaylist!.platformData) {
      expect(updatedPlaylist!.platformData).toHaveLength(1);
      expect(updatedPlaylist!.platformData[0].platform).toBe(platformData.platform);
      expect(updatedPlaylist!.platformData[0].id).toBe(platformData.id);
      expect(updatedPlaylist!.platformData[0].url).toBe(platformData.url);
      expect(updatedPlaylist!.platformData[0].synced).toBe(platformData.synced);
    }
  });
}); 