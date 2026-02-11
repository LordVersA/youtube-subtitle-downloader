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
 * Convert Unix timestamp to ISO 8601 format
 */
function unixToISO(unixTimestamp) {
  if (!unixTimestamp) return null;
  return new Date(unixTimestamp * 1000).toISOString();
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

    // Add anti-bot detection measures
    args.push(
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      '--extractor-args', 'youtube:player_client=web,android;player_skip=webpage,configs'
    );

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

    // Use release_timestamp (exact publish time) or timestamp as fallback
    const uploadTimestamp = data.release_timestamp || data.timestamp;

    return {
      id: data.id,
      title: sanitizeFilename(data.title || data.id),
      url: url,
      duration: data.duration,
      uploader: data.uploader,
      upload_date: unixToISO(uploadTimestamp),
      upload_date_raw: data.upload_date // YYYYMMDD format for filename
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
    console.log(`[DEBUG] Starting to fetch playlist from: ${url}`);

    const args = [
      '--flat-playlist',
      '--dump-single-json',
      '--js-runtimes', 'node'
    ];

    // Add anti-bot detection measures
    args.push(
      '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      '--extractor-args', 'youtube:player_client=web,android;player_skip=webpage,configs'
    );

    // Add cookies if provided
    if (options.cookies) {
      args.push('--cookies', options.cookies);
    }
    if (options.cookiesFromBrowser) {
      args.push('--cookies-from-browser', options.cookiesFromBrowser);
    }

    args.push(url);

    console.log(`[DEBUG] Executing yt-dlp with args: ${args.join(' ')}`);
    console.log(`[DEBUG] This might take a while as it fetches full metadata for all videos...`);

    const { stdout } = await executeYtDlp(args, getYtDlpPath());
    console.log(`[DEBUG] Received response from yt-dlp, parsing JSON...`);

    const data = JSON.parse(stdout);
    console.log(`[DEBUG] JSON parsed successfully`);

    // Extract entries from playlist
    const entries = data.entries || [];
    console.log(`[DEBUG] Found ${entries.length} entries in response`);

    // Log first entry to see what data we have
    if (entries.length > 0) {
      console.log(`[DEBUG] Sample entry data:`, {
        id: entries[0].id,
        title: entries[0].title?.substring(0, 50),
        upload_date: entries[0].upload_date,
        duration: entries[0].duration
      });
    }

    const videos = entries
      .filter(entry => entry && entry.id)
      .map(entry => {
        const uploadTimestamp = entry.release_timestamp || entry.timestamp;
        return {
          id: entry.id,
          title: sanitizeFilename(entry.title || entry.id),
          url: `https://www.youtube.com/watch?v=${entry.id}`,
          duration: entry.duration,
          uploader: entry.uploader,
          upload_date: unixToISO(uploadTimestamp),
          upload_date_raw: entry.upload_date,
          view_count: entry.view_count,
          description: entry.description
        };
      });

    console.log(`[DEBUG] Processed ${videos.length} videos`);

    if (videos.length === 0) {
      throw new Error(CONFIG.ERRORS.NO_VIDEOS);
    }

    await logger.debug(`Found ${videos.length} videos in playlist`);

    return videos;
  } catch (error) {
    console.error(`[ERROR] Failed in getPlaylistVideos: ${error.message}`);
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

/**
 * Enrich video with full metadata (upload_date, etc.)
 * This is called when we need full metadata for a specific video
 */
export async function enrichVideoMetadata(video, options = {}) {
  try {
    await logger.debug(`Enriching metadata for video: ${video.id}`);

    const fullInfo = await getVideoInfo(video.url, options);

    // Merge full info with existing video data
    return {
      ...video,
      upload_date: fullInfo.upload_date || video.upload_date,
      uploader: fullInfo.uploader || video.uploader,
      duration: fullInfo.duration || video.duration
    };
  } catch (error) {
    // If enrichment fails, return original video data
    await logger.debug(`Failed to enrich metadata for ${video.id}: ${error.message}`);
    return video;
  }
}
