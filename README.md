# yt-sub-dl

> A production-ready YouTube subtitle downloader with concurrent processing and advanced features

[![npm version](https://img.shields.io/npm/v/yt-sub-dl.svg)](https://www.npmjs.com/package/yt-sub-dl)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

A powerful Node.js CLI application to download YouTube subtitles from videos, playlists, and channels with advanced features including concurrent downloads, retry logic, and comprehensive progress tracking.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Command Line Options](#command-line-options)
- [Features in Detail](#features-in-detail)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- ✅ Download subtitles from YouTube videos, playlists, and channels
- ✅ Concurrent processing (configurable, default 3 simultaneous downloads)
- ✅ Automatic retry with exponential backoff for network failures
- ✅ Real-time progress tracking with multi-spinner display
- ✅ Convert VTT/SRT to plain text automatically
- ✅ Support multiple languages
- ✅ Comprehensive error handling and recovery
- ✅ Detailed statistics and summary reports
- ✅ Verbose logging with optional file output
- ✅ Smart filename sanitization and duplicate handling

## Quick Start

```bash
# Install dependencies
npm install -g yt-sub-dl

# Download subtitles
yt-sub-dl "https://www.youtube.com/watch?v=VIDEO_ID"
```

That's it! Subtitles will be saved to the `./output` directory.

## Installation

### Prerequisites

**Required:**
- Node.js >= 18.0.0
- yt-dlp (YouTube downloader)

**Optional:**
- FFmpeg (recommended for best compatibility)

### Install yt-dlp

```bash
# macOS
brew install yt-dlp

# Linux/Windows
pip install yt-dlp

# Or download from https://github.com/yt-dlp/yt-dlp
```

### Install the Application

#### Option 1: Install from npm (Recommended)

```bash
npm install -g yt-sub-dl
```

#### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/USERNAME/yt-sub-dl.git
cd yt-sub-dl

# Install dependencies
pnpm install
# or
npm install

# Link globally (optional)
npm link
```

## Usage

### Basic Usage

```bash
# Download subtitles from a single video
yt-sub-dl "https://www.youtube.com/watch?v=VIDEO_ID"

# Or if not linked
node src/index.js "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Download from Playlist

```bash
yt-sub-dl "https://www.youtube.com/playlist?list=PLAYLIST_ID"
```

### Download from Channel

```bash
yt-sub-dl "https://www.youtube.com/@channel-name"
```

### Advanced Options

```bash
# Specify output directory
yt-sub-dl URL -o ./my-subtitles

# Download multiple languages
yt-sub-dl URL -l en,es,fr

# Increase concurrent downloads
yt-sub-dl URL -c 5

# Keep original VTT/SRT files
yt-sub-dl URL --keep-original

# Enable verbose logging
yt-sub-dl URL -v

# Save logs to file
yt-sub-dl URL -v --log-file download.log

# Only download auto-generated subtitles
yt-sub-dl URL --auto-only

# Set maximum retry attempts
yt-sub-dl URL -r 5
```

## Command Line Options

```
Arguments:
  url                           YouTube video, playlist, or channel URL

Options:
  -o, --output <dir>           Output directory (default: "./output")
  -l, --langs <langs>          Subtitle languages, comma-separated (default: "en")
  -c, --concurrency <num>      Concurrent downloads (default: 3, max: 10)
  -r, --retries <num>          Max retry attempts (default: 3)
  --auto-only                  Only download auto-generated subtitles
  --keep-original              Keep original VTT/SRT files (default: delete after conversion)
  -v, --verbose                Enable verbose logging
  --log-file <path>            Write logs to file
  --skip-validation            Skip system dependency validation
  -h, --help                   Display help
  -V, --version                Display version
```

## Output Structure

```
output/
├── Video Title 1/
│   ├── Video Title 1.en.txt
│   └── Video Title 1.es.txt
├── Video Title 2/
│   └── Video Title 2.en.txt
└── Video Title 3/
    └── Video Title 3.en.txt
```

## Example Output

```
🔍 Validating system dependencies...
✓ All dependencies validated

🔍 Analyzing URL...
✓ Found 15 video(s)

⠹ Overall Progress: 47% | 7 succeeded | 1 failed
  ✔ Introduction to Node.js
  ✔ Advanced JavaScript Patterns
  ✖ Private Video: This video is private
  ⠹ Processing: Async/Await Deep Dive
  ⠋ Processing: Understanding Promises

╠════════════════════════════════════════════════════════╣
📊 DOWNLOAD SUMMARY
╠════════════════════════════════════════════════════════╣
Total Videos: 15
✓ Succeeded: 14
✗ Failed: 1
Success Rate: 93%
Total Time: 2m 34s
Avg Time/Video: 10.2s
Total Size: 847.32 KB
Languages: en
╠════════════════════════════════════════════════════════╣
```

## Features in Detail

### Concurrent Downloads

Process multiple videos simultaneously with configurable concurrency:
- Default: 3 concurrent downloads
- Range: 1-10 concurrent downloads
- Optimized for network efficiency

### Retry Logic

Automatic retry with exponential backoff:
- Default: 3 retry attempts
- Exponential backoff: 1s → 2s → 4s
- Smart detection of non-retryable errors (404, private videos)
- Configurable retry count

### Progress Tracking

Real-time progress display:
- Overall progress percentage
- Individual video status spinners
- Success/failure indicators with colors
- Comprehensive final summary

### Error Handling

Graceful error recovery:
- Individual failures don't stop batch processing
- Clear error messages with context
- Optional verbose mode for debugging
- Non-retryable errors fail fast

### Statistics

Comprehensive metrics:
- Total/succeeded/failed counts
- Success rate percentage
- Total execution time
- Average time per video
- Total file size
- Languages downloaded

## Troubleshooting

### YouTube "Sign in to confirm you're not a bot" Error

YouTube sometimes requires authentication to prevent bot access. If you see this error:

```
ERROR: Sign in to confirm you're not a bot
```

**Solution**: Use browser cookies with yt-dlp

1. Export cookies from your browser using a browser extension (e.g., "Get cookies.txt")
2. Use the cookies file:
   ```bash
   yt-dlp --cookies cookies.txt [URL]
   ```

Or use the `--cookies-from-browser` option:
```bash
yt-dlp --cookies-from-browser chrome [URL]
```

**Note**: This application currently doesn't support passing cookies. You may need to use yt-dlp directly with cookies, or wait and try again later when YouTube's bot detection is less strict.

### yt-dlp not found

Make sure yt-dlp is installed and in your PATH:

```bash
yt-dlp --version
```

If not found, install it:

```bash
# macOS
brew install yt-dlp

# Linux/Windows
pip install yt-dlp
```

### No subtitles available

Some videos don't have subtitles. The tool will:
- Skip videos without subtitles
- Continue processing remaining videos
- Report which videos failed

### Rate limiting

YouTube may rate limit requests. The tool will:
- Automatically retry with longer delays
- Use exponential backoff
- Eventually fail if limit persists

To avoid rate limiting:
- Reduce concurrency: `-c 2`
- Add delays between requests

### Permission errors

Make sure you have write permissions in the output directory:

```bash
# Check permissions
ls -la ./output

# Create directory with proper permissions
mkdir -p ./output
chmod 755 ./output
```

## Development

### Project Structure

```
yt-sub-dl/
├── src/
│   ├── index.js              # CLI entry point
│   ├── core/
│   │   ├── downloader.js     # Main orchestrator
│   │   ├── extractor.js      # URL detection & extraction
│   │   ├── parser.js         # Subtitle conversion
│   │   └── validator.js      # System validation
│   ├── lib/
│   │   ├── retry.js          # Retry logic
│   │   ├── queue.js          # Concurrent queue
│   │   ├── progress.js       # Progress tracking
│   │   └── stats.js          # Statistics
│   ├── utils/
│   │   ├── file.js           # File operations
│   │   ├── logger.js         # Logging
│   │   └── errors.js         # Error classes
│   └── config/
│       └── constants.js      # Configuration
└── package.json
```

### Running Tests

```bash
# Single video
node src/index.js "https://www.youtube.com/watch?v=VIDEO_ID" -v

# Playlist
node src/index.js "https://www.youtube.com/playlist?list=PLAYLIST_ID" -v

# With all options
node src/index.js URL -o ./test -l en,es -c 5 -v --log-file test.log
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloader
- [ytdlp-nodejs](https://github.com/n4r1b/ytdlp-nodejs) - Node.js wrapper
- [subsrt](https://github.com/papnkukn/subsrt) - Subtitle parser
