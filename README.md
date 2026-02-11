# yt-sub-dl

> A production-ready YouTube subtitle downloader with concurrent processing and advanced features

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
- ✅ Search and filter videos in a YouTube channel by query
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
# Clone the repository
git clone https://github.com/LordVersA/youtube-subtitle-downloader.git
cd youtube-subtitle-downloader

# Download subtitles
node src/index.js "https://www.youtube.com/watch?v=VIDEO_ID"
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

### Clone the Repository

```bash
# Clone the repository
git clone https://github.com/LordVersA/youtube-subtitle-downloader.git
cd youtube-subtitle-downloader
```

No additional dependencies or npm packages required! Just Node.js and yt-dlp.

## Usage

### Basic Usage

```bash
# Download subtitles from a single video
node src/index.js "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Download from Playlist

```bash
node src/index.js "https://www.youtube.com/playlist?list=PLAYLIST_ID"
```

### Download from Channel

```bash
node src/index.js "https://www.youtube.com/@channel-name"
```

### Search Channel Videos

Search for specific videos in a YouTube channel and save results to JSON:

```bash
# Search for videos containing "tutorial" in a channel
node src/index.js search "https://www.youtube.com/@channel-name" "tutorial"

# Search in channel streams
node src/index.js search "https://www.youtube.com/@channel-name/streams" "live"

# Search in channel videos
node src/index.js search "https://www.youtube.com/@channel-name/videos" "python"

# Specify output file
node src/index.js search "https://www.youtube.com/@channel-name" "python" -o ./results.json

# With verbose logging
node src/index.js search "https://www.youtube.com/@channel-name" "javascript" -v
```

The search results will include:
- Video title
- YouTube URL
- Upload date
- Uploader name
- Duration
- View count

### Advanced Options

```bash
# Specify output directory
node src/index.js URL -o ./my-subtitles

# Download multiple languages
node src/index.js URL -l en,es,fr

# Increase concurrent downloads
node src/index.js URL -c 5

# Keep original VTT/SRT files
node src/index.js URL --keep-original

# Enable verbose logging
node src/index.js URL -v

# Save logs to file
node src/index.js URL -v --log-file download.log

# Only download auto-generated subtitles
node src/index.js URL --auto-only

# Set maximum retry attempts
node src/index.js URL -r 5
```

## Command Line Options

### Main Command (Download Subtitles)

```
Usage: node src/index.js <url> [options]

Arguments:
  url                           YouTube video, playlist, or channel URL

Options:
  -o, --output <dir>           Output directory (default: "./output")
  -l, --langs <langs>          Subtitle languages, comma-separated (default: "en")
  -c, --concurrency <num>      Concurrent downloads (default: 3, max: 10)
  -r, --retries <num>          Max retry attempts (default: 3)
  --format <format>            Output format: txt or json (default: txt)
  --auto-only                  Only download auto-generated subtitles
  --keep-original              Keep original VTT/SRT files (default: delete after conversion)
  --cookies <file>             Path to cookies file for authentication
  --cookies-from-browser <br>  Browser to extract cookies from
  -v, --verbose                Enable verbose logging
  --log-file <path>            Write logs to file
  --skip-validation            Skip system dependency validation
  -h, --help                   Display help
  -V, --version                Display version
```

### Search Command

```
Usage: node src/index.js search <channel-url> <query> [options]

Arguments:
  channel-url                  YouTube channel URL
  query                        Search query to filter video titles

Options:
  -o, --output <file>          Output JSON file path (default: "./search-results.json")
  --cookies <file>             Path to cookies file for authentication
  --cookies-from-browser <br>  Browser to extract cookies from
  -v, --verbose                Enable verbose logging
  --log-file <path>            Write logs to file
  --skip-validation            Skip system dependency validation
  -h, --help                   Display help
```

## Output Structure

### Subtitle Downloads

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

### Search Results

The search command outputs a JSON file with this structure:

```json
{
  "query": "tutorial",
  "channel_url": "https://www.youtube.com/@channel-name",
  "search_date": "2026-02-08T12:34:56.789Z",
  "total_results": 15,
  "videos": [
    {
      "title": "Python Tutorial for Beginners",
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "upload_date": "2024-01-15",
      "uploader": "Channel Name",
      "duration": 1234,
      "view_count": 50000
    },
    {
      "title": "Advanced Python Tutorial",
      "url": "https://www.youtube.com/watch?v=VIDEO_ID_2",
      "upload_date": "2024-02-20",
      "uploader": "Channel Name",
      "duration": 2100,
      "view_count": 75000
    }
  ]
}
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
│   │   ├── searcher.js       # Channel video search
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

# Search command
node src/index.js search "https://www.youtube.com/@channel-name" "tutorial" -v

# Search with custom output
node src/index.js search "https://www.youtube.com/@channel-name" "python" -o ./my-results.json
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloader
- [ytdlp-nodejs](https://github.com/n4r1b/ytdlp-nodejs) - Node.js wrapper
- [subsrt](https://github.com/papnkukn/subsrt) - Subtitle parser
