/**
 * Custom error classes for the application
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DependencyError extends Error {
  constructor(message, dependency) {
    super(message);
    this.name = 'DependencyError';
    this.dependency = dependency;
  }
}

export class DownloadError extends Error {
  constructor(message, videoId, isRetryable = true) {
    super(message);
    this.name = 'DownloadError';
    this.videoId = videoId;
    this.isRetryable = isRetryable;
  }
}

export class ExtractionError extends Error {
  constructor(message, url) {
    super(message);
    this.name = 'ExtractionError';
    this.url = url;
  }
}

export class ParseError extends Error {
  constructor(message, filePath) {
    super(message);
    this.name = 'ParseError';
    this.filePath = filePath;
  }
}

export class FileOperationError extends Error {
  constructor(message, path, operation) {
    super(message);
    this.name = 'FileOperationError';
    this.path = path;
    this.operation = operation;
  }
}

/**
 * Determine if an error is retryable based on its type and message
 */
export function isRetryableError(error) {
  // Non-retryable conditions
  const nonRetryablePatterns = [
    /video.*not available/i,
    /video.*private/i,
    /video.*deleted/i,
    /video.*removed/i,
    /invalid.*url/i,
    /404/i,
    /no.*subtitle/i,
    /subtitle.*not.*available/i,
    /permission denied/i,
    /access denied/i
  ];

  const errorMessage = error.message || '';

  // Check if error matches any non-retryable pattern
  if (nonRetryablePatterns.some(pattern => pattern.test(errorMessage))) {
    return false;
  }

  // DownloadError has explicit retryable flag
  if (error instanceof DownloadError) {
    return error.isRetryable;
  }

  // Network errors and timeouts are retryable
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /rate.*limit/i,
    /too many requests/i,
    /503/i,
    /502/i
  ];

  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}
