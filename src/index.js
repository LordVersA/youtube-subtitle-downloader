#!/usr/bin/env node

/**
 * YouTube Subtitle Downloader CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

import { validateSystem } from './core/validator.js';
import { extractVideos, validateUrl } from './core/extractor.js';
import { downloadSubtitles } from './core/downloader.js';
import { searchChannelVideos, saveSearchResults } from './core/searcher.js';
import { logger } from './utils/logger.js';
import { CONFIG } from './config/constants.js';
import { ValidationError, DependencyError } from './utils/errors.js';

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  await readFile(path.join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

// Root program - no argument, no action
program
  .name('yt-sub-dl')
  .description('Download YouTube subtitles and search channel videos')
  .version(packageJson.version);

/**
 * Handle errors and display appropriate messages
 */
async function handleError(error) {
  console.error();

  if (error instanceof ValidationError) {
    console.error(chalk.red('❌ Validation Error:'));
    console.error(chalk.red(error.message));
  } else if (error instanceof DependencyError) {
    console.error(chalk.red('❌ Dependency Error:'));
    console.error(chalk.red(error.message));

    if (error.dependency === 'yt-dlp') {
      console.error();
      console.error(chalk.yellow('Installation instructions:'));
      console.error(chalk.cyan('  macOS:    brew install yt-dlp'));
      console.error(chalk.cyan('  Linux:    pip install yt-dlp'));
      console.error(chalk.cyan('  Windows:  pip install yt-dlp'));
      console.error();
      console.error(chalk.dim('Or download from: https://github.com/yt-dlp/yt-dlp'));
    }
  } else {
    console.error(chalk.red('❌ Error:'));
    console.error(chalk.red(error.message));

    if (logger.verbose) {
      console.error();
      console.error(chalk.dim('Stack trace:'));
      console.error(chalk.dim(error.stack));
    }
  }

  await logger.error(`Fatal error: ${error.message}`);

  console.error();
  process.exit(1);
}

// Download command (main functionality)
program
  .command('download')
  .description('Download subtitles from YouTube URL')
  .argument('<url>', 'YouTube video, playlist, or channel URL')
  .option('-o, --output <dir>', 'Output directory', CONFIG.DEFAULT_OUTPUT_DIR)
  .option('-l, --langs <langs>', 'Subtitle languages (comma-separated)', 'en')
  .option('-c, --concurrency <num>', 'Concurrent downloads', String(CONFIG.DEFAULT_CONCURRENCY))
  .option('-r, --retries <num>', 'Max retry attempts', String(CONFIG.DEFAULT_MAX_RETRIES))
  .option('--auto-only', 'Only download auto-generated subtitles', false)
  .option('--keep-original', 'Keep original VTT/SRT files', false)
  .option('--format <format>', 'Output format: txt or json (default: txt)', 'txt')
  .option('--cookies <file>', 'Path to cookies file for authentication')
  .option('--cookies-from-browser <browser>', 'Browser to extract cookies from (chrome, firefox, safari, etc.)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--log-file <path>', 'Write logs to file')
  .option('--skip-validation', 'Skip system dependency validation', false)
  .action(async (url, options) => {
    try {
      // Setup logging
      logger.setVerbose(options.verbose);

      if (options.logFile) {
        const logPath = path.resolve(options.logFile);
        await logger.setLogFile(logPath);
        await logger.info(`Logging to file: ${logPath}`);
      }

      // Validate URL
      if (!validateUrl(url)) {
        throw new ValidationError(CONFIG.ERRORS.INVALID_URL);
      }

      // Parse options
      const languages = options.langs.split(',').map(lang => lang.trim());
      const concurrency = Math.min(
        Math.max(parseInt(options.concurrency, 10), CONFIG.MIN_CONCURRENCY),
        CONFIG.MAX_CONCURRENCY
      );
      const maxRetries = parseInt(options.retries, 10);
      const outputDir = path.resolve(options.output);
      const format = options.format.toLowerCase();

      // Resolve cookies path to absolute if provided
      const cookiesPath = options.cookies ? path.resolve(options.cookies) : null;

      // Validate format option
      if (!['txt', 'json'].includes(format)) {
        throw new ValidationError('Format must be either "txt" or "json"');
      }

      await logger.debug(`Configuration: ${JSON.stringify({
        url,
        outputDir,
        languages,
        concurrency,
        maxRetries,
        autoOnly: options.autoOnly,
        keepOriginal: options.keepOriginal,
        format: format,
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      })}`);

      // Validate system dependencies
      if (!options.skipValidation) {
        console.log(chalk.cyan('🔍 Validating system dependencies...'));
        await validateSystem();
        console.log(chalk.green('✓ Dependencies validated\n'));
      }

      // Extract videos from URL
      console.log(chalk.cyan('🔍 Analyzing URL...'));
      const videos = await extractVideos(url, {
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      });
      console.log(chalk.green(`✓ Found ${videos.length} video(s)\n`));

      await logger.info(`Extracted ${videos.length} video(s) from URL`);

      // Download subtitles
      const result = await downloadSubtitles(videos, {
        outputDir,
        languages,
        concurrency,
        maxRetries,
        autoOnly: options.autoOnly,
        keepOriginal: options.keepOriginal,
        format: format,
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      });

      // Exit with appropriate code
      const exitCode = result.failed.length > 0 ? 1 : 0;

      if (exitCode === 0) {
        console.log(chalk.green.bold('\n✓ All downloads completed successfully!\n'));
      } else {
        console.log(chalk.yellow.bold(`\n⚠ Completed with ${result.failed.length} failure(s)\n`));
      }

      process.exit(exitCode);
    } catch (error) {
      await handleError(error);
    }
  });

// Search command
program
  .command('search')
  .description('Search for videos in a YouTube channel by query')
  .argument('<channel-url>', 'YouTube channel URL')
  .argument('<query>', 'Search query to filter video titles')
  .option('-o, --output <file>', 'Output JSON file path', './search-results.json')
  .option('--cookies <file>', 'Path to cookies file for authentication')
  .option('--cookies-from-browser <browser>', 'Browser to extract cookies from (chrome, firefox, safari, etc.)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--log-file <path>', 'Write logs to file')
  .option('--skip-validation', 'Skip system dependency validation', false)
  .action(async (channelUrl, query, options) => {
    try {
      // Setup logging
      logger.setVerbose(options.verbose);

      if (options.logFile) {
        const logPath = path.resolve(options.logFile);
        await logger.setLogFile(logPath);
        await logger.info(`Logging to file: ${logPath}`);
      }

      // Validate URL
      if (!validateUrl(channelUrl)) {
        throw new ValidationError('Invalid YouTube channel URL');
      }

      const outputPath = path.resolve(options.output);

      // Resolve cookies path to absolute if provided
      const cookiesPath = options.cookies ? path.resolve(options.cookies) : null;

      await logger.debug(`Configuration: ${JSON.stringify({
        channelUrl,
        query,
        outputPath,
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      })}`);

      // Validate system dependencies
      if (!options.skipValidation) {
        console.log(chalk.cyan('🔍 Validating system dependencies...'));
        await validateSystem();
        console.log(chalk.green('✓ Dependencies validated'));
      }

      // Search for videos
      console.log(chalk.cyan('\n🔍 Searching channel for videos...'));
      const results = await searchChannelVideos(channelUrl, query, {
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      });

      console.log(chalk.green(`✓ Found ${results.length} video(s) matching "${query}"\n`));

      // Save results to JSON file
      if (results.length > 0) {
        await saveSearchResults(results, outputPath, query, channelUrl);
        console.log(chalk.green(`✓ Results saved to: ${outputPath}\n`));

        // Display preview of results
        console.log(chalk.bold('Preview of results:'));
        results.slice(0, 5).forEach((video, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${video.title}`));
          console.log(chalk.dim(`   URL: ${video.url}`));
          console.log(chalk.dim(`   Upload Date: ${video.upload_date || 'N/A'}`));
          console.log(chalk.dim(`   Uploader: ${video.uploader || 'N/A'}`));
        });

        if (results.length > 5) {
          console.log(chalk.dim(`\n... and ${results.length - 5} more result(s)\n`));
        }
      } else {
        console.log(chalk.yellow(`⚠ No videos found matching "${query}"\n`));
      }

      process.exit(0);
    } catch (error) {
      await handleError(error);
    }
  });

// Download from JSON command
program
  .command('download-json')
  .description('Download subtitles from a search results JSON file')
  .argument('<json-file>', 'Path to search results JSON file')
  .option('-o, --output <dir>', 'Output directory', CONFIG.DEFAULT_OUTPUT_DIR)
  .option('-l, --langs <langs>', 'Subtitle languages (comma-separated)', 'en')
  .option('-c, --concurrency <num>', 'Concurrent downloads', String(CONFIG.DEFAULT_CONCURRENCY))
  .option('-r, --retries <num>', 'Max retry attempts', String(CONFIG.DEFAULT_MAX_RETRIES))
  .option('--auto-only', 'Only download auto-generated subtitles', false)
  .option('--keep-original', 'Keep original VTT/SRT files', false)
  .option('--format <format>', 'Output format: txt or json (default: txt)', 'txt')
  .option('--cookies <file>', 'Path to cookies file for authentication')
  .option('--cookies-from-browser <browser>', 'Browser to extract cookies from (chrome, firefox, safari, etc.)')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--log-file <path>', 'Write logs to file')
  .option('--skip-validation', 'Skip system dependency validation', false)
  .action(async (jsonFile, options) => {
    try {
      // Setup logging
      logger.setVerbose(options.verbose);

      if (options.logFile) {
        const logPath = path.resolve(options.logFile);
        await logger.setLogFile(logPath);
        await logger.info(`Logging to file: ${logPath}`);
      }

      // Parse options
      const languages = options.langs.split(',').map(lang => lang.trim());
      const concurrency = Math.min(
        Math.max(parseInt(options.concurrency, 10), CONFIG.MIN_CONCURRENCY),
        CONFIG.MAX_CONCURRENCY
      );
      const maxRetries = parseInt(options.retries, 10);
      const outputDir = path.resolve(options.output);
      const format = options.format.toLowerCase();
      const jsonPath = path.resolve(jsonFile);

      // Resolve cookies path to absolute if provided
      const cookiesPath = options.cookies ? path.resolve(options.cookies) : null;

      // Validate format option
      if (!['txt', 'json'].includes(format)) {
        throw new ValidationError('Format must be either "txt" or "json"');
      }

      await logger.debug(`Configuration: ${JSON.stringify({
        jsonPath,
        outputDir,
        languages,
        concurrency,
        maxRetries,
        autoOnly: options.autoOnly,
        keepOriginal: options.keepOriginal,
        format: format,
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      })}`);

      // Read and parse JSON file
      console.log(chalk.cyan('🔍 Reading JSON file...'));
      let searchData;
      try {
        const jsonContent = await readFile(jsonPath, 'utf-8');
        searchData = JSON.parse(jsonContent);
      } catch (error) {
        throw new ValidationError(`Failed to read or parse JSON file: ${error.message}`);
      }

      // Extract videos from JSON
      if (!searchData.videos || !Array.isArray(searchData.videos)) {
        throw new ValidationError('Invalid JSON format: missing or invalid "videos" array');
      }

      // Transform videos to include id field (extracted from URL)
      const videos = searchData.videos.map(video => {
        // Extract video ID from URL
        const urlMatch = video.url.match(/[?&]v=([^&]+)/);
        const id = urlMatch ? urlMatch[1] : video.url.split('/').pop();

        return {
          id: id,
          title: video.title,
          url: video.url,
          duration: video.duration,
          upload_date: video.upload_date
        };
      });

      console.log(chalk.green(`✓ Loaded ${videos.length} video(s) from JSON\n`));

      if (searchData.query) {
        console.log(chalk.dim(`Search query: "${searchData.query}"`));
      }
      if (searchData.channel_url) {
        console.log(chalk.dim(`Channel: ${searchData.channel_url}`));
      }
      console.log();

      await logger.info(`Loaded ${videos.length} video(s) from JSON file`);

      // Validate system dependencies
      if (!options.skipValidation) {
        console.log(chalk.cyan('🔍 Validating system dependencies...'));
        await validateSystem();
        console.log(chalk.green('✓ Dependencies validated\n'));
      }

      // Download subtitles
      const result = await downloadSubtitles(videos, {
        outputDir,
        languages,
        concurrency,
        maxRetries,
        autoOnly: options.autoOnly,
        keepOriginal: options.keepOriginal,
        format: format,
        cookies: cookiesPath,
        cookiesFromBrowser: options.cookiesFromBrowser
      });

      // Exit with appropriate code
      const exitCode = result.failed.length > 0 ? 1 : 0;

      if (exitCode === 0) {
        console.log(chalk.green.bold('\n✓ All downloads completed successfully!\n'));
      } else {
        console.log(chalk.yellow.bold(`\n⚠ Completed with ${result.failed.length} failure(s)\n`));
      }

      process.exit(exitCode);
    } catch (error) {
      await handleError(error);
    }
  });

// Handle uncaught errors
process.on('unhandledRejection', async (error) => {
  await logger.error(`Unhandled rejection: ${error.message}`);
  await handleError(error);
});

process.on('uncaughtException', async (error) => {
  await logger.error(`Uncaught exception: ${error.message}`);
  await handleError(error);
});

// Parse command line arguments
program.parse();
