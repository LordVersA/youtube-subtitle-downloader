/**
 * Concurrent download queue management
 */

import pLimit from 'p-limit';
import { logger } from '../utils/logger.js';

/**
 * Process items concurrently with a limit
 *
 * @param {Array} items - Items to process
 * @param {Function} processFn - Async function to process each item
 * @param {number} concurrency - Maximum concurrent operations
 * @returns {Promise<Object>} Results with success and failure arrays
 */
export async function processQueue(items, processFn, concurrency) {
  const limit = pLimit(concurrency);
  const results = {
    succeeded: [],
    failed: []
  };

  await logger.debug(`Processing ${items.length} items with concurrency ${concurrency}`);

  // Create limited promises for all items
  const promises = items.map((item, index) =>
    limit(async () => {
      try {
        const result = await processFn(item, index);
        results.succeeded.push({
          item,
          result,
          index
        });
        return { success: true, item, result };
      } catch (error) {
        results.failed.push({
          item,
          error,
          index
        });
        return { success: false, item, error };
      }
    })
  );

  // Wait for all promises to settle
  await Promise.all(promises);

  await logger.debug(`Queue completed: ${results.succeeded.length} succeeded, ${results.failed.length} failed`);

  return results;
}

/**
 * Create a queue processor with progress tracking
 *
 * @param {number} concurrency - Maximum concurrent operations
 * @returns {Object} Queue processor with methods
 */
export function createQueue(concurrency) {
  const limit = pLimit(concurrency);
  const active = new Set();
  const completed = [];
  const failed = [];

  return {
    /**
     * Add item to queue
     */
    add: async (item, processFn) => {
      return limit(async () => {
        active.add(item);
        try {
          const result = await processFn(item);
          completed.push({ item, result });
          return result;
        } catch (error) {
          failed.push({ item, error });
          throw error;
        } finally {
          active.delete(item);
        }
      });
    },

    /**
     * Get queue statistics
     */
    getStats: () => ({
      active: active.size,
      completed: completed.length,
      failed: failed.length,
      total: completed.length + failed.length
    }),

    /**
     * Get results
     */
    getResults: () => ({
      completed,
      failed
    })
  };
}
