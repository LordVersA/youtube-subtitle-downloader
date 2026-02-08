/**
 * Progress tracking and display
 */

import ora from 'ora';
import chalk from 'chalk';

class ProgressTracker {
  constructor() {
    this.mainSpinner = null;
    this.videoSpinners = new Map();
    this.stats = {
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0
    };
  }

  /**
   * Initialize progress tracking
   */
  start(totalVideos) {
    this.stats.total = totalVideos;
    this.mainSpinner = ora({
      text: this.getMainSpinnerText(),
      color: 'cyan'
    }).start();
  }

  /**
   * Start tracking a video download
   */
  startVideo(videoId, title) {
    const spinner = ora({
      text: chalk.dim(this.truncate(title, 60)),
      color: 'blue',
      indent: 2
    });

    this.videoSpinners.set(videoId, {
      spinner,
      title,
      status: 'processing'
    });

    this.updateDisplay();
  }

  /**
   * Mark video as succeeded
   */
  succeedVideo(videoId, title) {
    this.stats.completed++;
    this.stats.succeeded++;

    const video = this.videoSpinners.get(videoId);
    if (video) {
      video.status = 'succeeded';
      video.spinner.succeed(chalk.green(this.truncate(title || video.title, 60)));
    }

    this.updateMainSpinner();
  }

  /**
   * Mark video as failed
   */
  failVideo(videoId, title, errorMessage) {
    this.stats.completed++;
    this.stats.failed++;

    const video = this.videoSpinners.get(videoId);
    if (video) {
      video.status = 'failed';
      const message = `${this.truncate(title || video.title, 50)} - ${chalk.red(errorMessage)}`;
      video.spinner.fail(message);
    }

    this.updateMainSpinner();
  }

  /**
   * Update main spinner text
   */
  updateMainSpinner() {
    if (this.mainSpinner) {
      this.mainSpinner.text = this.getMainSpinnerText();
    }
  }

  /**
   * Update display for all spinners
   */
  updateDisplay() {
    // Show only active video spinners (limit to show concurrent ones)
    let activeCount = 0;
    for (const [videoId, video] of this.videoSpinners.entries()) {
      if (video.status === 'processing') {
        if (activeCount < 5) { // Show max 5 concurrent spinners
          if (!video.spinner.isSpinning) {
            video.spinner.start();
          }
          activeCount++;
        }
      }
    }
  }

  /**
   * Get main spinner text with progress
   */
  getMainSpinnerText() {
    const percentage = this.stats.total > 0
      ? Math.round((this.stats.completed / this.stats.total) * 100)
      : 0;

    const parts = [
      chalk.bold(`Overall Progress: ${percentage}%`),
      chalk.green(`${this.stats.succeeded} succeeded`),
    ];

    if (this.stats.failed > 0) {
      parts.push(chalk.red(`${this.stats.failed} failed`));
    }

    return parts.join(chalk.dim(' | '));
  }

  /**
   * Complete progress tracking
   */
  complete() {
    if (this.mainSpinner) {
      if (this.stats.failed === 0) {
        this.mainSpinner.succeed(chalk.green.bold('All downloads completed successfully!'));
      } else {
        this.mainSpinner.warn(chalk.yellow.bold(`Completed with ${this.stats.failed} failure(s)`));
      }
    }

    // Stop any remaining spinners
    for (const video of this.videoSpinners.values()) {
      if (video.spinner.isSpinning) {
        video.spinner.stop();
      }
    }
  }

  /**
   * Stop all spinners
   */
  stop() {
    if (this.mainSpinner) {
      this.mainSpinner.stop();
    }

    for (const video of this.videoSpinners.values()) {
      video.spinner.stop();
    }
  }

  /**
   * Truncate text to max length
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Get current statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

export { ProgressTracker };
