/**
 * Statistics collection and reporting
 */

import chalk from 'chalk';
import { formatDuration, formatFileSize } from '../utils/file.js';

class StatsCollector {
  constructor() {
    this.reset();
  }

  /**
   * Reset statistics
   */
  reset() {
    this.startTime = Date.now();
    this.endTime = null;
    this.videos = {
      total: 0,
      succeeded: 0,
      failed: 0
    };
    this.files = {
      count: 0,
      totalSize: 0
    };
    this.languages = new Set();
    this.errors = [];
  }

  /**
   * Start tracking
   */
  start(totalVideos) {
    this.startTime = Date.now();
    this.videos.total = totalVideos;
  }

  /**
   * Record successful download
   */
  recordSuccess(videoId, title, fileSize, languages) {
    this.videos.succeeded++;
    this.files.count++;
    this.files.totalSize += fileSize || 0;

    if (Array.isArray(languages)) {
      languages.forEach(lang => this.languages.add(lang));
    }
  }

  /**
   * Record failed download
   */
  recordFailure(videoId, title, error) {
    this.videos.failed++;
    this.errors.push({
      videoId,
      title,
      error: error.message
    });
  }

  /**
   * End tracking
   */
  end() {
    this.endTime = Date.now();
  }

  /**
   * Get total elapsed time
   */
  getElapsedTime() {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * Get average time per video
   */
  getAverageTime() {
    const completed = this.videos.succeeded + this.videos.failed;
    if (completed === 0) return 0;
    return this.getElapsedTime() / completed;
  }

  /**
   * Get success rate percentage
   */
  getSuccessRate() {
    if (this.videos.total === 0) return 0;
    return Math.round((this.videos.succeeded / this.videos.total) * 100);
  }

  /**
   * Generate summary report
   */
  generateReport() {
    const elapsed = this.getElapsedTime();
    const avgTime = this.getAverageTime();
    const successRate = this.getSuccessRate();

    const lines = [
      '',
      chalk.bold('╠════════════════════════════════════════════════════════╣'),
      chalk.bold.cyan('📊 DOWNLOAD SUMMARY'),
      chalk.bold('╠════════════════════════════════════════════════════════╣'),
      `Total Videos: ${chalk.bold(this.videos.total)}`,
      `${chalk.green('✓')} Succeeded: ${chalk.bold.green(this.videos.succeeded)}`,
    ];

    if (this.videos.failed > 0) {
      lines.push(`${chalk.red('✗')} Failed: ${chalk.bold.red(this.videos.failed)}`);
    }

    lines.push(
      `Success Rate: ${chalk.bold(successRate + '%')}`,
      `Total Time: ${chalk.bold(formatDuration(elapsed))}`,
      `Avg Time/Video: ${chalk.bold(formatDuration(avgTime))}`
    );

    if (this.files.totalSize > 0) {
      lines.push(`Total Size: ${chalk.bold(formatFileSize(this.files.totalSize))}`);
    }

    if (this.languages.size > 0) {
      lines.push(`Languages: ${chalk.bold([...this.languages].join(', '))}`);
    }

    lines.push(chalk.bold('╠════════════════════════════════════════════════════════╣'));

    // Add error details if there are any
    if (this.errors.length > 0 && this.errors.length <= 5) {
      lines.push('');
      lines.push(chalk.bold.red('Failed Videos:'));
      this.errors.forEach(({ title, error }) => {
        lines.push(chalk.red(`  • ${title}: ${error}`));
      });
    } else if (this.errors.length > 5) {
      lines.push('');
      lines.push(chalk.red(`${this.errors.length} videos failed (use --verbose for details)`));
    }

    return lines.join('\n');
  }

  /**
   * Get statistics object
   */
  getStats() {
    return {
      videos: { ...this.videos },
      files: { ...this.files },
      languages: [...this.languages],
      elapsed: this.getElapsedTime(),
      averageTime: this.getAverageTime(),
      successRate: this.getSuccessRate(),
      errors: [...this.errors]
    };
  }
}

export { StatsCollector };
