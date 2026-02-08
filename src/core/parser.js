/**
 * Subtitle file parsing and conversion
 */

import subsrt from 'subsrt';
import { readFile, writeFile, deleteFile } from '../utils/file.js';
import { ParseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Convert VTT/SRT subtitle file to plain text
 */
export async function convertToPlainText(subtitlePath, outputPath, deleteOriginal = true) {
  try {
    await logger.debug(`Converting subtitle file: ${subtitlePath}`);

    // Read subtitle file
    const content = await readFile(subtitlePath);

    // Parse subtitle format (auto-detect VTT or SRT)
    let captions;
    try {
      captions = subsrt.parse(content);
    } catch (error) {
      throw new ParseError(
        `Failed to parse subtitle file: ${error.message}`,
        subtitlePath
      );
    }

    // Extract text content and deduplicate
    const lines = [];
    let previousText = '';

    for (const caption of captions) {
      // Skip captions without text
      if (!caption.text) {
        continue;
      }

      const text = caption.text.trim();

      // Skip empty lines and duplicates
      if (text && text !== previousText) {
        lines.push(text);
        previousText = text;
      }
    }

    // Join lines with newlines
    const plainText = lines.join('\n');

    // Write to output file
    await writeFile(outputPath, plainText);

    await logger.debug(`Converted to plain text: ${outputPath}`);

    // Delete original subtitle file if requested
    if (deleteOriginal) {
      await deleteFile(subtitlePath);
      await logger.debug(`Deleted original subtitle file: ${subtitlePath}`);
    }

    return plainText;
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(
      `Conversion failed: ${error.message}`,
      subtitlePath
    );
  }
}

/**
 * Find subtitle files in a directory
 */
export async function findSubtitleFiles(directory) {
  const { glob } = await import('glob');

  const vttFiles = await glob(`${directory}/**/*.vtt`);
  const srtFiles = await glob(`${directory}/**/*.srt`);

  return [...vttFiles, ...srtFiles];
}

/**
 * Get plain text output path for subtitle file
 */
export function getPlainTextPath(subtitlePath) {
  const dir = path.dirname(subtitlePath);
  const basename = path.basename(subtitlePath, path.extname(subtitlePath));
  return path.join(dir, `${basename}.txt`);
}
