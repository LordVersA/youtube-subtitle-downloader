/**
 * URL analysis and video extraction
 */

import { URL_PATTERNS, CONFIG } from '../config/constants.js';
import { ExtractionError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sanitizeFilename } from '../utils/file.js';
import { executeYtDlp, findYtDlpPath } from '../utils/ytdlp.js';

let ytdlpPath = null;

/**
 * Get yt-dlp binary path
 */
function getYtDlpPath() {
  if (!ytdlpPath) {
    ytdlpPath = findYtDlpPath();
  }
  return ytdlpPath;
}

/**
 * Detect URL type (video, playlist, or channel)
 */
export function detectUrlType(url) {
  if (URL_PATTERNS.PLAYLIST.test(url)) {
    return 'playlist';
  } else if (URL_PATTERNS.CHANNEL.test(url)) {
    return 'channel';
  } else if (URL_PATTERNS.VIDEO.test(url)) {
    return 'video';
  }
  return null;
}

/**
 * Extract video information from URL
 */
export async function extractVideos(url, options = {}) {
  await logger.debug(`Extracting videos from URL: ${url}`);

  const urlType = detectUrlType(url);

  if (!urlType) {
    throw new ValidationError(CONFIG.ERRORS.INVALID_URL);
  }

  await logger.debug(`URL type detected: ${urlType}`);

  try {
    if (urlType === 'video') {
      // Single video
      const info = await getVideoInfo(url, options);
      return [info];
    } else {
      // Playlist or channel - get list of videos
      const videos = await getPlaylistVideos(url, options);
      return videos;
    }
  } catch (error) {
    throw new ExtractionError(
      `Failed to extract videos: ${error.message}`,
      url
    );
  }
}

/**
 * Get information for a single video
 */
async function getVideoInfo(url, options = {}) {
  try {
    await logger.debug(`Fetching video info for: ${url}`);

    const args = [
      '--dump-single-json',
      '--skip-download',
      '--js-runtimes', 'node'
    ];

    // Add cookies if provided
    if (options.cookies) {
      args.push('--cookies', options.cookies);
    }
    if (options.cookiesFromBrowser) {
      args.push('--cookies-from-browser', options.cookiesFromBrowser);
    }

    args.push(url);

    const { stdout } = await executeYtDlp(args, getYtDlpPath());
    const data = JSON.parse(stdout);

    return {
      id: data.id,
      title: sanitizeFilename(data.title || data.id),
      url: url,
      duration: data.duration,
      uploader: data.uploader
    };
  } catch (error) {
    throw new Error(`Failed to get video info: ${error.message}`);
  }
}

/**
 * Get list of videos from playlist or channel
 */
async function getPlaylistVideos(url, options = {}) {
  try {
    await logger.debug(`Fetching playlist videos for: ${url}`);

    const args = [
      '--flat-playlist',
      '--dump-single-json',
      '--js-runtimes', 'node'
    ];

    // Add cookies if provided
    if (options.cookies) {
      args.push('--cookies', options.cookies);
    }
    if (options.cookiesFromBrowser) {
      args.push('--cookies-from-browser', options.cookiesFromBrowser);
    }

    args.push(url);

    const { stdout } = await executeYtDlp(args, getYtDlpPath());
    const data = JSON.parse(stdout);

    // Extract entries from playlist
    const entries = data.entries || [];

    const videos = entries
      .filter(entry => entry && entry.id)
      .map(entry => ({
        id: entry.id,
        title: sanitizeFilename(entry.title || entry.id),
        url: `https://www.youtube.com/watch?v=${entry.id}`,
        duration: entry.duration,
        uploader: entry.uploader
      }));

    if (videos.length === 0) {
      throw new Error(CONFIG.ERRORS.NO_VIDEOS);
    }

    await logger.debug(`Found ${videos.length} videos in playlist`);

    return videos;
  } catch (error) {
    throw new Error(`Failed to get playlist videos: ${error.message}`);
  }
}

/**
 * Validate YouTube URL
 */
export function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    const validHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];

    if (!validHosts.includes(urlObj.hostname)) {
      return false;
    }

    return detectUrlType(url) !== null;
  } catch {
    return false;
  }
}
