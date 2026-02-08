/**
 * Retry logic with exponential backoff
 */

import { CONFIG } from '../config/constants.js';
import { isRetryableError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Execute a function with retry logic
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.baseDelay - Base delay in milliseconds
 * @param {number} options.maxDelay - Maximum delay in milliseconds
 * @param {number} options.backoffFactor - Exponential backoff factor
 * @param {string} options.context - Context for logging
 * @returns {Promise} Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = CONFIG.DEFAULT_MAX_RETRIES,
    baseDelay = CONFIG.RETRY_BASE_DELAY,
    maxDelay = CONFIG.RETRY_MAX_DELAY,
    backoffFactor = CONFIG.RETRY_BACKOFF_FACTOR,
    context = 'Operation'
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        await logger.debug(`${context}: Non-retryable error, failing fast - ${error.message}`);
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt > maxRetries) {
        await logger.debug(`${context}: Max retries (${maxRetries}) exhausted`);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );

      await logger.debug(`${context}: Attempt ${attempt} failed, retrying in ${delay}ms - ${error.message}`);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
