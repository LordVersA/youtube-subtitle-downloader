/**
 * Main download orchestrator
 */

import path from 'path';
import { ensureDir, sanitizeFilename, getFileSize } from '../utils/file.js';
import { DownloadError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../lib/retry.js';
import { processQueue } from '../lib/queue.js';
import { ProgressTracker } from '../lib/progress.js';
import { StatsCollector } from '../lib/stats.js';
import { convertToPlainText, findSubtitleFiles } from './parser.js';
import { CONFIG } from '../config/constants.js';
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
 * Download subtitles for multiple videos
 */
export async function downloadSubtitles(videos, options = {}) {
  const {
    outputDir = CONFIG.DEFAULT_OUTPUT_DIR,
    languages = CONFIG.DEFAULT_LANGUAGES,
    concurrency = CONFIG.DEFAULT_CONCURRENCY,
    maxRetries = CONFIG.DEFAULT_MAX_RETRIES,
    autoOnly = false,
    keepOriginal = false,
    cookies = null,
    cookiesFromBrowser = null
  } = options;

  // Initialize tracking
  const progress = new ProgressTracker();
  const stats = new StatsCollector();

  stats.start(videos.length);
  progress.start(videos.length);

  await logger.info(`\n🔍 Processing ${videos.length} video(s)...`);

  // Process videos concurrently
  const results = await processQueue(
    videos,
    async (video, index) => {
      progress.startVideo(video.id, video.title);

      try {
        // Download subtitle with retry logic
        const result = await withRetry(
          () => downloadVideoSubtitle(video, outputDir, languages, autoOnly, keepOriginal, cookies, cookiesFromBrowser),
          {
            maxRetries,
            context: `Download ${video.title}`
          }
        );

        progress.succeedVideo(video.id, video.title);
        stats.recordSuccess(video.id, video.title, result.totalSize, languages);

        return result;
      } catch (error) {
        const errorMessage = error.message.slice(0, 100);
        progress.failVideo(video.id, video.title, errorMessage);
        stats.recordFailure(video.id, video.title, error);

        await logger.error(`Failed to download ${video.title}: ${error.message}`);

        throw error;
      }
    },
    concurrency
  );

  // Complete tracking
  progress.complete();
  stats.end();

  // Display summary
  console.log(stats.generateReport());

  return {
    succeeded: results.succeeded,
    failed: results.failed,
    stats: stats.getStats()
  };
}

/**
 * Download subtitle for a single video
 */
async function downloadVideoSubtitle(video, outputDir, languages, autoOnly, keepOriginal, cookies, cookiesFromBrowser) {
  await logger.debug(`Downloading subtitle for: ${video.title}`);

  // Create output directory for this video
  const videoDir = path.join(outputDir, sanitizeFilename(video.title));
  await ensureDir(videoDir);

  // Build yt-dlp arguments
  const args = [
    '--skip-download',
    '--sub-langs', languages.join(','),
    '--output', path.join(videoDir, '%(title)s.%(ext)s'),
    '--js-runtimes', 'node'
  ];

  // Add subtitle download flags based on autoOnly option
  if (autoOnly) {
    // Only download auto-generated subtitles
    args.unshift('--write-auto-subs');
  } else {
    // Only download manual/original subtitles
    args.unshift('--write-subs');
  }

  // Add cookies if provided
  if (cookies) {
    args.push('--cookies', cookies);
  }
  if (cookiesFromBrowser) {
    args.push('--cookies-from-browser', cookiesFromBrowser);
  }

  args.push(video.url);

  try {
    // Execute yt-dlp
    await logger.debug(`Downloading subtitles for ${video.url}`);
    await executeYtDlp(args, getYtDlpPath());

    // Find downloaded subtitle files
    const subtitleFiles = await findSubtitleFiles(videoDir);

    if (subtitleFiles.length === 0) {
      throw new DownloadError(
        'No subtitles available for this video',
        video.id,
        false // Not retryable
      );
    }

    await logger.debug(`Found ${subtitleFiles.length} subtitle file(s)`);

    // Convert all subtitle files to plain text
    let totalSize = 0;
    for (const subtitleFile of subtitleFiles) {
      const outputPath = subtitleFile.replace(/\.(vtt|srt)$/, '.txt');
      await convertToPlainText(subtitleFile, outputPath, !keepOriginal);

      const size = await getFileSize(outputPath);
      totalSize += size;
    }

    await logger.success(`Downloaded subtitles for: ${video.title}`);

    return {
      videoId: video.id,
      title: video.title,
      directory: videoDir,
      filesCount: subtitleFiles.length,
      totalSize
    };
  } catch (error) {
    // Check if it's a known non-retryable error
    const errorMessage = error.message || error.toString();

    if (
      errorMessage.includes('No subtitles') ||
      errorMessage.includes('not available') ||
      errorMessage.includes('private') ||
      errorMessage.includes('deleted')
    ) {
      throw new DownloadError(errorMessage, video.id, false);
    }

    // Otherwise, it might be retryable
    throw new DownloadError(errorMessage, video.id, true);
  }
}
