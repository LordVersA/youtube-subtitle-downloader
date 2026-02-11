/**
 * YouTube channel video search functionality
 */

import path from 'path';
import { extractVideos, detectUrlType } from './extractor.js';
import { logger } from '../utils/logger.js';
import { writeFile, ensureDir } from '../utils/file.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Format upload date from YYYYMMDD to YYYY-MM-DD
 */
function formatUploadDate(uploadDate) {
  if (!uploadDate) return null;

  const dateStr = String(uploadDate);
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

/**
 * Search for videos in a YouTube channel matching a query
 */
export async function searchChannelVideos(channelUrl, query, options = {}) {
  await logger.debug(`Searching channel for query: "${query}"`);
  console.log(`[DEBUG] Starting search for query: "${query}"`);

  // Validate that URL is a channel
  const urlType = detectUrlType(channelUrl);
  if (urlType !== 'channel') {
    throw new ValidationError('URL must be a YouTube channel URL');
  }
  console.log(`[DEBUG] URL type validated as: ${urlType}`);

  // Extract all videos from channel
  await logger.info('Extracting videos from channel...');
  console.log(`[DEBUG] Calling extractVideos() - this may take several minutes...`);

  const videos = await extractVideos(channelUrl, {
    cookies: options.cookies,
    cookiesFromBrowser: options.cookiesFromBrowser
  });

  console.log(`[DEBUG] extractVideos() completed`);
  await logger.info(`Found ${videos.length} total videos in channel`);

  // Filter videos by query (case-insensitive search in title)
  const queryLower = query.toLowerCase();
  const matchedVideos = videos.filter(video =>
    video.title.toLowerCase().includes(queryLower)
  );

  await logger.info(`Found ${matchedVideos.length} videos matching query: "${query}"`);

  // Map to result format using data from initial extraction
  const results = matchedVideos.map(video => ({
    title: video.title,
    url: video.url,
    upload_date: formatUploadDate(video.upload_date),
    uploader: video.uploader,
    duration: video.duration,
    view_count: video.view_count
  }));

  return results;
}

/**
 * Save search results to JSON file
 */
export async function saveSearchResults(results, outputPath, query, channelUrl) {
  await logger.debug(`Saving search results to: ${outputPath}`);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await ensureDir(outputDir);

  // Prepare JSON data
  const data = {
    query: query,
    channel_url: channelUrl,
    search_date: new Date().toISOString(),
    total_results: results.length,
    videos: results
  };

  // Write to file
  await writeFile(outputPath, JSON.stringify(data, null, 2));
  await logger.info(`Results saved to: ${outputPath}`);

  return outputPath;
}
