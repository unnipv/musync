import { ITrack } from '@/types/track';

/**
 * Normalizes a string for comparison by removing special characters,
 * converting to lowercase, and trimming whitespace
 * 
 * @param str - The string to normalize
 * @returns The normalized string
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')    // Replace multiple spaces with a single space
    .trim();
}

/**
 * Calculates the Levenshtein distance between two strings
 * 
 * @param a - First string
 * @param b - Second string
 * @returns The Levenshtein distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates the similarity score between two strings (0-1)
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0 and 1
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);
  
  if (normalizedA === normalizedB) return 1;
  
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - distance / maxLength;
}

/**
 * Calculates a match score between two tracks based on title and artist
 * 
 * @param track1 - First track
 * @param track2 - Second track
 * @returns Match score between 0 and 1
 */
export function calculateTrackMatchScore(track1: ITrack, track2: ITrack): number {
  const titleSimilarity = stringSimilarity(track1.title, track2.title);
  const artistSimilarity = stringSimilarity(track1.artist, track2.artist);
  
  // Title is weighted more heavily than artist
  return titleSimilarity * 0.6 + artistSimilarity * 0.4;
}

/**
 * Finds the best match for a track in a list of tracks
 * 
 * @param track - The track to find a match for
 * @param candidateTracks - List of potential matching tracks
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns The best matching track or null if no match above threshold
 */
export function findBestTrackMatch(
  track: ITrack, 
  candidateTracks: ITrack[], 
  threshold = 0.8
): ITrack | null {
  let bestMatch: ITrack | null = null;
  let bestScore = threshold;
  
  for (const candidate of candidateTracks) {
    const score = calculateTrackMatchScore(track, candidate);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

/**
 * Matches tracks between two platforms
 * 
 * @param sourceTracks - Tracks from the source platform
 * @param targetTracks - Tracks from the target platform
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Object containing matched, unmatched, and new tracks
 */
export function matchTracks(
  sourceTracks: ITrack[],
  targetTracks: ITrack[],
  threshold = 0.8
): {
  matched: Array<{ source: ITrack; target: ITrack; score: number }>;
  unmatchedSource: ITrack[];
  unmatchedTarget: ITrack[];
} {
  const matched: Array<{ source: ITrack; target: ITrack; score: number }> = [];
  const unmatchedSource = [...sourceTracks];
  const unmatchedTarget = [...targetTracks];
  
  // First pass: Find exact matches (same title and artist)
  for (let i = unmatchedSource.length - 1; i >= 0; i--) {
    const sourceTrack = unmatchedSource[i];
    
    for (let j = unmatchedTarget.length - 1; j >= 0; j--) {
      const targetTrack = unmatchedTarget[j];
      
      if (
        normalizeString(sourceTrack.title) === normalizeString(targetTrack.title) &&
        normalizeString(sourceTrack.artist) === normalizeString(targetTrack.artist)
      ) {
        matched.push({ 
          source: sourceTrack, 
          target: targetTrack, 
          score: 1.0 
        });
        
        unmatchedSource.splice(i, 1);
        unmatchedTarget.splice(j, 1);
        break;
      }
    }
  }
  
  // Second pass: Find fuzzy matches for remaining tracks
  for (let i = unmatchedSource.length - 1; i >= 0; i--) {
    const sourceTrack = unmatchedSource[i];
    let bestMatch: ITrack | null = null;
    let bestScore = threshold;
    let bestIndex = -1;
    
    for (let j = 0; j < unmatchedTarget.length; j++) {
      const targetTrack = unmatchedTarget[j];
      const score = calculateTrackMatchScore(sourceTrack, targetTrack);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = targetTrack;
        bestIndex = j;
      }
    }
    
    if (bestMatch) {
      matched.push({ 
        source: sourceTrack, 
        target: bestMatch, 
        score: bestScore 
      });
      
      unmatchedSource.splice(i, 1);
      unmatchedTarget.splice(bestIndex, 1);
    }
  }
  
  return { matched, unmatchedSource, unmatchedTarget };
} 