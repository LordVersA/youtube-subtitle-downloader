/**
 * Application configuration constants
 */

export const CONFIG = {
  // Concurrency settings
  DEFAULT_CONCURRENCY: 3,
  MAX_CONCURRENCY: 10,
  MIN_CONCURRENCY: 1,

  // Retry settings
  DEFAULT_MAX_RETRIES: 3,
  RETRY_BASE_DELAY: 1000, // 1 second
  RETRY_MAX_DELAY: 30000, // 30 seconds
  RETRY_BACKOFF_FACTOR: 2,

  // Default settings
  DEFAULT_OUTPUT_DIR: './output',
  DEFAULT_LANGUAGES: ['en'],

  // System requirements
  MIN_NODE_VERSION: '18.0.0',

  // File settings
  MAX_FILENAME_LENGTH: 200,

  // Progress display
  SPINNER_INTERVAL: 80,

  // yt-dlp options
  YTDLP_TIMEOUT: 60000, // 60 seconds per download

  // Subtitle formats
  SUBTITLE_FORMATS: ['vtt', 'srt'],

  // Error messages
  ERRORS: {
    YTDLP_NOT_FOUND: 'yt-dlp is not installed. Please install it first:\n  brew install yt-dlp (macOS)\n  pip install yt-dlp (Linux/Windows)',
    NODE_VERSION: `Node.js version ${this?.MIN_NODE_VERSION || '18.0.0'} or higher is required`,
    INVALID_URL: 'Invalid YouTube URL provided',
    NO_VIDEOS: 'No videos found at the provided URL',
    NO_SUBTITLES: 'No subtitles available for this video',
  }
};

export const URL_PATTERNS = {
  VIDEO: /(?:(?:www\.)?youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  PLAYLIST: /[?&]list=([a-zA-Z0-9_-]+)/,
  CHANNEL: /(?:www\.)?youtube\.com\/((?:channel|c|user)\/|@)([a-zA-Z0-9_-]+)(?:\/(?:videos|streams|playlists|community|about)?)?/
};
