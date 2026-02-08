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

program
  .name('yt-sub-dl')
  .description('Download YouTube subtitles from videos, playlists, and channels')
  .version(packageJson.version)
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
        cookies: options.cookies,
        cookiesFromBrowser: options.cookiesFromBrowser
      })}`)

      // Validate system dependencies
      if (!options.skipValidation) {
        await validateSystem();
      }

      // Extract videos from URL
      console.log(chalk.cyan('\n🔍 Analyzing URL...'));
      const videos = await extractVideos(url, {
        cookies: options.cookies,
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
        cookies: options.cookies,
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
