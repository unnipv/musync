/**
 * YouTube API Quota Tracker
 * 
 * This module provides utilities to track and limit YouTube API usage
 * to prevent exceeding the daily quota limit.
 * 
 * YouTube API operations have different quota costs:
 * - Read operations (search, list): 1-100 units
 * - Write operations (insert, update): 50-100 units
 * - Delete operations: 50 units
 * 
 * The default daily quota is 10,000 units.
 */

// Cache entry interface for quota tracking
interface QuotaEntry {
  /** Timestamp when the entry was created */
  timestamp: number;
  /** Quota units used */
  units: number;
}

// Operation types and their quota costs
export enum YouTubeOperationType {
  READ_LIGHT = 'read_light',     // Simple read operations (1 unit)
  READ_HEAVY = 'read_heavy',     // Heavy read operations like search (100 units)
  WRITE = 'write',               // Write operations (50 units)
  DELETE = 'delete'              // Delete operations (50 units)
}

// Quota costs for different operation types
const QUOTA_COSTS: Record<YouTubeOperationType, number> = {
  [YouTubeOperationType.READ_LIGHT]: 1,
  [YouTubeOperationType.READ_HEAVY]: 100,
  [YouTubeOperationType.WRITE]: 50,
  [YouTubeOperationType.DELETE]: 50
};

// Add quota persistence interface
interface QuotaStore {
  saveQuotaUsage(entries: QuotaEntry[]): Promise<void>;
  loadQuotaUsage(): Promise<QuotaEntry[]>;
}

// Use environment variable for quota limit with fallback
const DEFAULT_DAILY_QUOTA = parseInt(process.env.YOUTUBE_QUOTA_LIMIT || '10000', 10);

// Safety threshold - stop at 90% of quota to leave room for critical operations
const QUOTA_SAFETY_THRESHOLD = 0.9;

// In-memory storage for quota tracking
class YouTubeQuotaTracker {
  private quotaUsage: QuotaEntry[] = [];
  private dailyQuota: number;
  private safetyThreshold: number;
  
  constructor(dailyQuota = DEFAULT_DAILY_QUOTA, safetyThreshold = QUOTA_SAFETY_THRESHOLD) {
    this.dailyQuota = dailyQuota;
    this.safetyThreshold = safetyThreshold;
    
    // Clean up old entries every hour
    setInterval(() => this.cleanupOldEntries(), 60 * 60 * 1000);
  }
  
  /**
   * Records quota usage for an operation
   * 
   * @param operationType - Type of operation performed
   * @param count - Number of operations (default: 1)
   * @returns The total units consumed
   */
  recordUsage(operationType: YouTubeOperationType, count = 1): number {
    const units = QUOTA_COSTS[operationType] * count;
    
    this.quotaUsage.push({
      timestamp: Date.now(),
      units
    });
    
    return units;
  }
  
  /**
   * Gets the total quota used in the last 24 hours
   * 
   * @returns Total quota units used
   */
  getQuotaUsed(): number {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    return this.quotaUsage
      .filter(entry => entry.timestamp >= oneDayAgo)
      .reduce((total, entry) => total + entry.units, 0);
  }
  
  /**
   * Gets the remaining quota available
   * 
   * @returns Remaining quota units
   */
  getRemainingQuota(): number {
    return Math.max(0, this.dailyQuota - this.getQuotaUsed());
  }
  
  /**
   * Checks if performing an operation would exceed the quota
   * 
   * @param operationType - Type of operation to check
   * @param count - Number of operations (default: 1)
   * @returns Whether the operation would exceed the quota
   */
  wouldExceedQuota(operationType: YouTubeOperationType, count = 1): boolean {
    const requiredUnits = QUOTA_COSTS[operationType] * count;
    const safeQuotaLimit = this.dailyQuota * this.safetyThreshold;
    
    return (this.getQuotaUsed() + requiredUnits) > safeQuotaLimit;
  }
  
  /**
   * Checks if an operation can be performed within quota limits
   * 
   * @param operationType - Type of operation to check
   * @param count - Number of operations (default: 1)
   * @returns Whether the operation can be performed
   */
  canPerformOperation(operationType: YouTubeOperationType, count = 1): boolean {
    return !this.wouldExceedQuota(operationType, count);
  }
  
  /**
   * Removes entries older than 24 hours to prevent memory leaks
   */
  private cleanupOldEntries(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.quotaUsage = this.quotaUsage.filter(entry => entry.timestamp >= oneDayAgo);
  }
  
  /**
   * Gets quota usage statistics
   * 
   * @returns Object with quota statistics
   */
  getQuotaStats(): {used: number, remaining: number, total: number, percentUsed: number} {
    const used = this.getQuotaUsed();
    const remaining = this.getRemainingQuota();
    
    return {
      used,
      remaining,
      total: this.dailyQuota,
      percentUsed: (used / this.dailyQuota) * 100
    };
  }
}

// Create a singleton instance
export const youtubeQuotaTracker = new YouTubeQuotaTracker();

/**
 * Middleware function to check if an operation can be performed
 * 
 * @param operationType - Type of operation to check
 * @param count - Number of operations (default: 1)
 * @returns Whether the operation can be performed
 * @throws Error if quota would be exceeded
 */
export function checkQuotaBeforeOperation(operationType: YouTubeOperationType, count = 1): boolean {
  if (youtubeQuotaTracker.wouldExceedQuota(operationType, count)) {
    throw new Error(`YouTube API quota limit reached (${youtubeQuotaTracker.getQuotaStats().percentUsed.toFixed(1)}% used). Please try again later.`);
  }
  
  return true;
}

/**
 * Records quota usage for an operation
 * 
 * @param operationType - Type of operation performed
 * @param count - Number of operations (default: 1)
 */
export function recordQuotaUsage(operationType: YouTubeOperationType, count = 1): void {
  youtubeQuotaTracker.recordUsage(operationType, count);
}

/**
 * Gets current quota usage statistics
 * 
 * @returns Object with quota statistics
 */
export function getYouTubeQuotaStats(): {used: number, remaining: number, total: number, percentUsed: number} {
  return youtubeQuotaTracker.getQuotaStats();
}

/**
 * Groups YouTube operations into optimal batches to minimize quota usage
 * 
 * @param items - Array of items to process
 * @param batchSize - Maximum size for each batch
 * @param operationType - Type of YouTube operation
 * @returns Array of batched items
 */
export function batchYouTubeOperations<T>(
  items: T[], 
  batchSize: number, 
  operationType: YouTubeOperationType
): T[][] {
  // If quota is critically low, use smaller batches to ensure some operations succeed
  const quotaStats = youtubeQuotaTracker.getQuotaStats();
  const quotaPercentRemaining = (quotaStats.remaining / quotaStats.total) * 100;
  
  // Adjust batch size based on remaining quota
  let adjustedBatchSize = batchSize;
  if (quotaPercentRemaining < 30) {
    // If less than 30% quota remains, use smaller batches
    adjustedBatchSize = Math.max(1, Math.floor(batchSize / 2));
  } else if (quotaPercentRemaining < 10) {
    // If less than 10% quota remains, use minimum batch size
    adjustedBatchSize = 1;
  }
  
  // Use the helper function to chunk the array
  return chunkArray(items, adjustedBatchSize);
}

/**
 * Chunks an array into multiple arrays of specified size
 * 
 * @param array - The array to chunk
 * @param chunkSize - The size of each chunk
 * @returns The chunked array
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  if (!array || array.length === 0) {
    return []; // Return empty array if input is empty
  }
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
} 