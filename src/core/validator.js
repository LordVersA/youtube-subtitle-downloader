/**
 * System validation and dependency checks
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { DependencyError } from '../utils/errors.js';
import { CONFIG } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Validate system dependencies
 */
export async function validateSystem() {
  // Check Node.js version
  await validateNodeVersion();

  // Check yt-dlp installation
  await validateYtDlp();

  // Check FFmpeg (optional, just warn)
  await checkFFmpeg();

  await logger.debug('All dependencies validated');
}

/**
 * Validate Node.js version
 */
async function validateNodeVersion() {
  const currentVersion = process.version.slice(1); // Remove 'v' prefix
  const requiredVersion = CONFIG.MIN_NODE_VERSION;

  if (!isVersionValid(currentVersion, requiredVersion)) {
    throw new DependencyError(
      `Node.js version ${requiredVersion} or higher is required. Current version: ${currentVersion}`,
      'node'
    );
  }

  await logger.debug(`Node.js version: ${currentVersion} ✓`);
}

/**
 * Validate yt-dlp installation
 */
async function validateYtDlp() {
  try {
    const { stdout } = await execAsync('yt-dlp --version');
    const version = stdout.trim();
    await logger.debug(`yt-dlp version: ${version} ✓`);
  } catch (error) {
    throw new DependencyError(
      CONFIG.ERRORS.YTDLP_NOT_FOUND,
      'yt-dlp'
    );
  }
}

/**
 * Check FFmpeg (optional)
 */
async function checkFFmpeg() {
  try {
    await execAsync('ffmpeg -version');
    await logger.debug('FFmpeg found ✓');
  } catch (error) {
    await logger.warn('FFmpeg not found (optional, but recommended for best compatibility)');
  }
}

/**
 * Compare version strings
 */
function isVersionValid(current, required) {
  const currentParts = current.split('.').map(Number);
  const requiredParts = required.split('.').map(Number);

  for (let i = 0; i < requiredParts.length; i++) {
    const currentPart = currentParts[i] || 0;
    const requiredPart = requiredParts[i] || 0;

    if (currentPart > requiredPart) return true;
    if (currentPart < requiredPart) return false;
  }

  return true;
}
