import { 
  normalizeString, 
  levenshteinDistance, 
  stringSimilarity, 
  calculateTrackMatchScore, 
  findBestTrackMatch, 
  matchTracks 
} from '../trackMatcher';
import { ITrack } from '@/types/track';

describe('Track Matcher', () => {
  describe('normalizeString', () => {
    it('should convert to lowercase', () => {
      expect(normalizeString('HELLO')).toBe('hello');
    });
    
    it('should remove special characters', () => {
      expect(normalizeString('Hello, World!')).toBe('hello world');
    });
    
    it('should handle empty strings', () => {
      expect(normalizeString('')).toBe('');
      expect(normalizeString(null as any)).toBe('');
      expect(normalizeString(undefined as any)).toBe('');
    });
  });
  
  describe('levenshteinDistance', () => {
    it('should calculate distance between identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });
    
    it('should calculate distance between different strings', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
    
    it('should handle empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'hello')).toBe(5);
    });
  });
  
  describe('stringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1);
    });
    
    it('should return a value between 0 and 1 for different strings', () => {
      const similarity = stringSimilarity('kitten', 'sitting');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
    
    it('should handle case and special characters', () => {
      expect(stringSimilarity('Hello, World!', 'hello world')).toBe(1);
    });
    
    it('should handle empty strings', () => {
      expect(stringSimilarity('', '')).toBe(1);
      expect(stringSimilarity('hello', '')).toBe(0);
      expect(stringSimilarity('', 'hello')).toBe(0);
    });
  });
  
  describe('calculateTrackMatchScore', () => {
    it('should return 1 for identical tracks', () => {
      const track1: ITrack = { title: 'Hello', artist: 'Adele' };
      const track2: ITrack = { title: 'Hello', artist: 'Adele' };
      
      expect(calculateTrackMatchScore(track1, track2)).toBe(1);
    });
    
    it('should weight title more heavily than artist', () => {
      const track1: ITrack = { title: 'Hello', artist: 'Adele' };
      const track2: ITrack = { title: 'Hello', artist: 'Someone Else' };
      const track3: ITrack = { title: 'Different Title', artist: 'Adele' };
      
      const score1 = calculateTrackMatchScore(track1, track2);
      const score2 = calculateTrackMatchScore(track1, track3);
      
      expect(score1).toBeGreaterThan(score2);
    });
  });
  
  describe('findBestTrackMatch', () => {
    it('should find the best match above threshold', () => {
      const track: ITrack = { title: 'Hello', artist: 'Adele' };
      const candidates: ITrack[] = [
        { title: 'Hello', artist: 'Someone Else' },
        { title: 'Hello', artist: 'Adele' },
        { title: 'Different', artist: 'Different' }
      ];
      
      const bestMatch = findBestTrackMatch(track, candidates);
      expect(bestMatch).toEqual(candidates[1]);
    });
    
    it('should return null if no match above threshold', () => {
      const track: ITrack = { title: 'Hello', artist: 'Adele' };
      const candidates: ITrack[] = [
        { title: 'Completely Different', artist: 'Someone Else' }
      ];
      
      const bestMatch = findBestTrackMatch(track, candidates, 0.9);
      expect(bestMatch).toBeNull();
    });
  });
  
  describe('matchTracks', () => {
    it('should match tracks between two platforms', () => {
      const sourceTracks: ITrack[] = [
        { title: 'Hello', artist: 'Adele' },
        { title: 'Someone Like You', artist: 'Adele' },
        { title: 'Unique Source Track', artist: 'Artist' }
      ];
      
      const targetTracks: ITrack[] = [
        { title: 'Hello', artist: 'Adele' },
        { title: 'Someone Like You', artist: 'Adele' },
        { title: 'Unique Target Track', artist: 'Artist' }
      ];
      
      const result = matchTracks(sourceTracks, targetTracks);
      
      expect(result.matched.length).toBe(2);
      expect(result.unmatchedSource.length).toBe(1);
      expect(result.unmatchedTarget.length).toBe(1);
      
      // Check that the correct tracks were matched
      expect(result.matched[0].source.title).toBe('Hello');
      expect(result.matched[0].target.title).toBe('Hello');
      expect(result.matched[1].source.title).toBe('Someone Like You');
      expect(result.matched[1].target.title).toBe('Someone Like You');
      
      // Check that the correct tracks were unmatched
      expect(result.unmatchedSource[0].title).toBe('Unique Source Track');
      expect(result.unmatchedTarget[0].title).toBe('Unique Target Track');
    });
    
    it('should handle empty track lists', () => {
      const result = matchTracks([], []);
      
      expect(result.matched.length).toBe(0);
      expect(result.unmatchedSource.length).toBe(0);
      expect(result.unmatchedTarget.length).toBe(0);
    });
  });
}); 