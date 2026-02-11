/**
 * Main download orchestrator
 */

import path from 'path';
import { ensureDir, sanitizeFilename, getFileSize, renameFile } from '../utils/file.js';
import { DownloadError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../lib/retry.js';
import { processQueue } from '../lib/queue.js';
import { ProgressTracker } from '../lib/progress.js';
import { StatsCollector } from '../lib/stats.js';
import { convertToPlainText, convertToJSON, findSubtitleFiles } from './parser.js';
import { CONFIG } from '../config/constants.js';
import { executeYtDlp, findYtDlpPath } from '../utils/ytdlp.js';
import { enrichVideoMetadata } from './extractor.js';

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
    format = 'txt',
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
          () => downloadVideoSubtitle(video, outputDir, languages, autoOnly, keepOriginal, format, cookies, cookiesFromBrowser),
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
async function downloadVideoSubtitle(video, outputDir, languages, autoOnly, keepOriginal, format, cookies, cookiesFromBrowser) {
  await logger.debug(`Downloading subtitle for: ${video.title}`);

  // Enrich video metadata if upload_date is missing
  let enrichedVideo = video;
  if (!video.upload_date) {
    console.log(`[DEBUG] Enriching metadata for video: ${video.id}`);
    enrichedVideo = await enrichVideoMetadata(video, { cookies, cookiesFromBrowser });
    console.log(`[DEBUG] Enriched upload_date: ${enrichedVideo.upload_date}`);
  }

  // Create a temporary directory for downloading (use video title for yt-dlp)
  // But we'll move files to flat output directory after
  const tempVideoDir = path.join(outputDir, '.temp', sanitizeFilename(enrichedVideo.title));
  await ensureDir(tempVideoDir);

  // Build yt-dlp arguments
  const args = [
    '--skip-download',
    '--sub-langs', languages.join(','),
    '--output', path.join(tempVideoDir, '%(title)s.%(ext)s')
  ];

  // Add subtitle download flags based on autoOnly option
  if (autoOnly) {
    // Only download auto-generated subtitles
    args.unshift('--write-auto-subs');
  } else {
    // Download both manual and auto-generated subtitles (prefer manual if available)
    args.unshift('--write-subs', '--write-auto-subs');
  }

  // Add anti-bot detection measures
  args.push(
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    '--sleep-interval', '2',
    '--max-sleep-interval', '5',
    '--extractor-args', 'youtube:player_client=ios,web',
    '--extractor-args', 'youtube:player_skip=configs'
  );

  // Add cookies if provided
  if (cookies) {
    args.push('--cookies', cookies);
  }
  if (cookiesFromBrowser) {
    args.push('--cookies-from-browser', cookiesFromBrowser);
  }

  args.push(enrichedVideo.url);

  try {
    // Execute yt-dlp
    await logger.debug(`Downloading subtitles for ${enrichedVideo.url}`);
    await executeYtDlp(args, getYtDlpPath());

    // Find downloaded subtitle files
    const subtitleFiles = await findSubtitleFiles(tempVideoDir);

    if (subtitleFiles.length === 0) {
      throw new DownloadError(
        'No subtitles available for this video',
        enrichedVideo.id,
        false // Not retryable
      );
    }

    await logger.debug(`Found ${subtitleFiles.length} subtitle file(s)`);

    // Generate new filename with format: releasedate-videoid
    // Use upload_date_raw (YYYYMMDD) for filename
    const uploadDate = enrichedVideo.upload_date_raw || 'unknown';
    const newFilenameBase = `${uploadDate}-${enrichedVideo.id}`;

    // Ensure main output directory exists
    await ensureDir(outputDir);

    // Convert all subtitle files based on format and move to flat output directory
    let totalSize = 0;
    const outputFiles = [];

    for (const subtitleFile of subtitleFiles) {
      if (format === 'json') {
        const tempOutputPath = subtitleFile.replace(/\.(vtt|srt)$/, '.json');
        // Pass video metadata to JSON converter
        const metadata = {
          title: enrichedVideo.title,
          duration: enrichedVideo.duration,
          upload_date: enrichedVideo.upload_date
        };
        await convertToJSON(subtitleFile, tempOutputPath, enrichedVideo.id, false, metadata);

        // Move to flat output directory with new name: releasedate-videoid.json
        const fileExt = path.extname(tempOutputPath);
        const langMatch = path.basename(tempOutputPath).match(/\.([a-z]{2}(-[a-z]+)?)\./i);
        const langCode = langMatch ? `.${langMatch[1]}` : '';
        const finalPath = path.join(outputDir, `${newFilenameBase}${langCode}${fileExt}`);
        await renameFile(tempOutputPath, finalPath);

        const size = await getFileSize(finalPath);
        totalSize += size;
        outputFiles.push(finalPath);
      } else {
        const tempOutputPath = subtitleFile.replace(/\.(vtt|srt)$/, '.txt');
        await convertToPlainText(subtitleFile, tempOutputPath, false);

        // Move to flat output directory with new name: releasedate-videoid.txt
        const fileExt = path.extname(tempOutputPath);
        const langMatch = path.basename(tempOutputPath).match(/\.([a-z]{2}(-[a-z]+)?)\./i);
        const langCode = langMatch ? `.${langMatch[1]}` : '';
        const finalPath = path.join(outputDir, `${newFilenameBase}${langCode}${fileExt}`);
        await renameFile(tempOutputPath, finalPath);

        const size = await getFileSize(finalPath);
        totalSize += size;
        outputFiles.push(finalPath);
      }
    }

    // Clean up temp directory
    try {
      const fs = await import('fs/promises');
      await fs.rm(tempVideoDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      await logger.debug(`Failed to clean up temp directory: ${error.message}`);
    }

    await logger.success(`Downloaded subtitles for: ${enrichedVideo.title}`);

    return {
      videoId: enrichedVideo.id,
      title: enrichedVideo.title,
      directory: outputDir,
      filesCount: subtitleFiles.length,
      totalSize,
      outputFiles
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
