/**
 * Subtitle file parsing and conversion
 */

import subsrt from 'subsrt';
import { readFile, writeFile, deleteFile } from '../utils/file.js';
import { ParseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import path from 'path';

/**
 * Parse VTT file with word-level timing tags
 */
function parseVTT(content) {
  const lines = content.split('\n');
  const textLines = [];
  let previousText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines, WEBVTT header, and timing lines
    if (!line ||
        line.startsWith('WEBVTT') ||
        line.includes('Kind:') ||
        line.includes('Language:') ||
        line.includes('-->')) {
      continue;
    }

    // Extract text and clean up formatting
    let text = line;

    // Remove word-level timing tags (e.g., <00:00:01.920>)
    text = text.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '');

    // Remove voice/styling tags (e.g., <c>, </c>, <v>, etc.)
    text = text.replace(/<\/?[a-z]>/gi, '');

    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Skip empty lines and duplicates
    if (text && text !== previousText) {
      textLines.push(text);
      previousText = text;
    }
  }

  return textLines.join('\n');
}

/**
 * Parse VTT file and extract timestamps with text
 */
function parseVTTWithTimestamps(content) {
  const lines = content.split('\n');
  const captions = [];
  let currentCaption = null;
  let previousText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header
    if (line.startsWith('WEBVTT') || line.includes('Kind:') || line.includes('Language:')) {
      continue;
    }

    // Check for timestamp line
    const timestampMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timestampMatch) {
      // Save previous caption if exists
      if (currentCaption && currentCaption.text && currentCaption.text !== previousText) {
        captions.push(currentCaption);
        previousText = currentCaption.text;
      }

      // Start new caption
      currentCaption = {
        start: timestampMatch[1],
        end: timestampMatch[2],
        text: ''
      };
      continue;
    }

    // Extract text content
    if (currentCaption && line) {
      let text = line;

      // Remove word-level timing tags
      text = text.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '');

      // Remove voice/styling tags
      text = text.replace(/<\/?[a-z]>/gi, '');

      // Clean up extra whitespace
      text = text.replace(/\s+/g, ' ').trim();

      if (text) {
        currentCaption.text = text;
      }
    }
  }

  // Add last caption
  if (currentCaption && currentCaption.text && currentCaption.text !== previousText) {
    captions.push(currentCaption);
  }

  return captions;
}

/**
 * Convert VTT/SRT subtitle file to plain text
 */
export async function convertToPlainText(subtitlePath, outputPath, deleteOriginal = true) {
  try {
    await logger.debug(`Converting subtitle file: ${subtitlePath}`);

    // Read subtitle file
    const content = await readFile(subtitlePath);

    // Detect file type
    const isVTT = subtitlePath.endsWith('.vtt');
    let plainText;

    if (isVTT) {
      // Custom VTT parser for word-level timed captions
      plainText = parseVTT(content);
    } else {
      // Use subsrt for SRT files
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
        if (!caption.text) continue;

        const text = caption.text.trim();
        if (text && text !== previousText) {
          lines.push(text);
          previousText = text;
        }
      }

      plainText = lines.join('\n');
    }

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
 * Convert VTT/SRT subtitle file to JSON with timestamps
 */
export async function convertToJSON(subtitlePath, outputPath, videoId, deleteOriginal = false) {
  try {
    await logger.debug(`Converting subtitle file to JSON: ${subtitlePath}`);

    // Read subtitle file
    const content = await readFile(subtitlePath);

    // Parse VTT with timestamps
    const captions = parseVTTWithTimestamps(content);

    // Create JSON structure
    const jsonData = {
      videoId: videoId,
      subtitles: captions
    };

    // Write to output file
    await writeFile(outputPath, JSON.stringify(jsonData, null, 2));

    await logger.debug(`Converted to JSON: ${outputPath}`);

    // Delete original subtitle file if requested
    if (deleteOriginal) {
      await deleteFile(subtitlePath);
      await logger.debug(`Deleted original subtitle file: ${subtitlePath}`);
    }

    return jsonData;
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(
      `JSON conversion failed: ${error.message}`,
      subtitlePath
    );
  }
}

/**
 * Get plain text output path for subtitle file
 */
export function getPlainTextPath(subtitlePath) {
  const dir = path.dirname(subtitlePath);
  const basename = path.basename(subtitlePath, path.extname(subtitlePath));
  return path.join(dir, `${basename}.txt`);
}
