/**
 * Simple yt-dlp wrapper with proper error handling
 */

import { execFile, execSync } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

/**
 * Find yt-dlp binary path
 */
export function findYtDlpPath() {
  try {
    const path = execSync('which yt-dlp', { encoding: 'utf-8' }).trim();
    return path;
  } catch {
    // Try common locations
    const commonPaths = [
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      '/opt/homebrew/bin/yt-dlp',
      process.env.HOME + '/.bin/yt-dlp',
      process.env.HOME + '/.local/bin/yt-dlp'
    ];

    for (const path of commonPaths) {
      try {
        execSync(`"${path}" --version`, { encoding: 'utf-8' });
        return path;
      } catch {
        continue;
      }
    }

    return 'yt-dlp';
  }
}

/**
 * Get Node.js path from nvm or system
 */
function getNodePath() {
  try {
    const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
    const nodeDir = nodePath.substring(0, nodePath.lastIndexOf('/'));
    return nodeDir;
  } catch {
    return null;
  }
}

/**
 * Execute yt-dlp with arguments
 */
export async function executeYtDlp(args, binaryPath = null) {
  const ytdlpPath = binaryPath || findYtDlpPath();

  try {
    await logger.debug(`Executing: ${ytdlpPath} ${args.join(' ')}`);

    // Ensure Node.js is available in PATH for solving n-challenge
    // Include nvm Node.js path if available
    const nodeDir = getNodePath();
    const pathDirs = [
      nodeDir,
      process.env.PATH,
      '/usr/local/bin',
      '/usr/bin',
      '/bin'
    ].filter(Boolean);

    const env = {
      ...process.env,
      PATH: pathDirs.join(':')
    };

    const { stdout, stderr } = await execFileAsync(ytdlpPath, args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 120000, // 2 minute timeout
      env: env
    });

    return { stdout, stderr };
  } catch (error) {
    // Include stderr in error message
    const errorMessage = error.stderr || error.message;
    const fullError = new Error(errorMessage);
    fullError.code = error.code;
    fullError.stderr = error.stderr;
    fullError.stdout = error.stdout;
    throw fullError;
  }
}
