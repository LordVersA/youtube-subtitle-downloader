/**
 * File operations and utilities
 */

import fs from 'fs/promises';
import path from 'path';
import { FileOperationError } from './errors.js';

/**
 * Sanitize filename to be safe for all operating systems
 */
export function sanitizeFilename(filename) {
  // Remove or replace invalid characters
  let sanitized = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.+$/, ''); // Remove trailing dots

  // Limit length to 200 characters to be safe
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = base.slice(0, 200 - ext.length) + ext;
  }

  // Fallback to timestamp if empty
  if (!sanitized) {
    sanitized = `subtitle_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Ensure filename is unique by appending number if needed
 */
export async function ensureUniqueFilename(filePath) {
  let counter = 1;
  let uniquePath = filePath;
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);

  while (await fileExists(uniquePath)) {
    uniquePath = `${base}_${counter}${ext}`;
    counter++;
  }

  return uniquePath;
}

/**
 * Check if file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new FileOperationError(
      `Failed to create directory: ${error.message}`,
      dirPath,
      'mkdir'
    );
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get file size
 */
export async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Delete file if exists
 */
export async function deleteFile(filePath) {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    throw new FileOperationError(
      `Failed to delete file: ${error.message}`,
      filePath,
      'unlink'
    );
  }
}

/**
 * Read file content
 */
export async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new FileOperationError(
      `Failed to read file: ${error.message}`,
      filePath,
      'read'
    );
  }
}

/**
 * Write file content
 */
export async function writeFile(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new FileOperationError(
      `Failed to write file: ${error.message}`,
      filePath,
      'write'
    );
  }
}
