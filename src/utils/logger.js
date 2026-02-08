/**
 * Logging utilities
 */

import fs from 'fs/promises';
import path from 'path';
import { fileExists } from './file.js';

class Logger {
  constructor() {
    this.verbose = false;
    this.logFile = null;
  }

  setVerbose(verbose) {
    this.verbose = verbose;
  }

  async setLogFile(logFilePath) {
    this.logFile = logFilePath;

    // Ensure log directory exists
    const logDir = path.dirname(logFilePath);
    await fs.mkdir(logDir, { recursive: true });

    // Clear previous log file
    await fs.writeFile(logFilePath, '');
  }

  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    // Always write to log file if configured
    if (this.logFile) {
      try {
        await fs.appendFile(this.logFile, logMessage);
      } catch (error) {
        // Silently fail if can't write to log file
      }
    }

    // Only output to console in verbose mode (except errors and warnings)
    if (this.verbose || level === 'error' || level === 'warn') {
      const prefix = {
        'error': '❌',
        'warn': '⚠️',
        'info': 'ℹ️',
        'debug': '🔍',
        'success': '✓'
      }[level] || '';

      console.log(`${prefix} ${message}`);
    }
  }

  async debug(message) {
    if (this.verbose) {
      await this.log(message, 'debug');
    }
  }

  async info(message) {
    await this.log(message, 'info');
  }

  async warn(message) {
    await this.log(message, 'warn');
  }

  async error(message) {
    await this.log(message, 'error');
  }

  async success(message) {
    await this.log(message, 'success');
  }
}

// Export singleton instance
export const logger = new Logger();
