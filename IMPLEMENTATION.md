# YouTube Subtitle Downloader - Implementation Plan

A Node.js application to download subtitles from YouTube videos, playlists, and channels, storing them as plain text files.

## Overview

This app will:
1. Accept YouTube URLs (video, playlist, or channel)
2. Extract video metadata and subtitle information
3. Download subtitles (auto-generated or manual)
4. Convert subtitles to plain text (removing timestamps)
5. Save as organized `.txt` files

---

## Technology Stack

### Core Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| **[ytdlp-nodejs](https://github.com/iqbal-rashed/ytdlp-nodejs)** | yt-dlp wrapper for Node.js - subtitle download, playlist/channel handling | Latest |
| **[subsrt](https://github.com/papnkukn/subsrt)** | Parse VTT/SRT subtitles and extract plain text | Latest |
| **commander** | CLI argument parsing | Latest |
| **ora** | Loading spinners for CLI | Latest |
| **chalk** | Terminal styling | Latest |

### System Requirements

- **Node.js** >= 18.x
- **yt-dlp** installed on system (`brew install yt-dlp` or `pip install yt-dlp`)
- **FFmpeg** (recommended for full functionality)

---

## Project Structure

```
yt-sub-dl/
├── package.json
├── src/
│   ├── index.js          # CLI entry point
│   ├── downloader.js     # YouTube subtitle download logic
│   ├── parser.js         # VTT/SRT to plain text conversion
│   ├── extractor.js      # URL type detection & video list extraction
│   └── utils.js          # Helper functions
├── output/               # Default output directory
│   └── [channel-name]/
│       └── [playlist-name]/
│           └── video-title.txt
└── IMPLEMENTATION.md
```

---

## Implementation Details

### 1. URL Type Detection (`extractor.js`)

```javascript
function detectUrlType(url) {
  if (url.includes('/playlist?list=')) return 'playlist';
  if (url.includes('/channel/') || url.includes('/@')) return 'channel';
  if (url.includes('watch?v=') || url.includes('youtu.be/')) return 'video';
  throw new Error('Invalid YouTube URL');
}
```

### 2. Video List Extraction (`extractor.js`)

Using `ytdlp-nodejs` to get video list from playlists/channels:

```javascript
import { YtDlp } from 'ytdlp-nodejs';

async function getVideoList(url) {
  const ytdlp = new YtDlp();

  // Use flat-playlist to get video URLs without downloading
  const info = await ytdlp
    .download(url)
    .addOption('--flat-playlist')
    .addOption('--dump-json')
    .skipDownload()
    .run();

  return info.entries.map(entry => ({
    id: entry.id,
    title: entry.title,
    url: `https://www.youtube.com/watch?v=${entry.id}`
  }));
}
```

### 3. Subtitle Download (`downloader.js`)

```javascript
import { YtDlp } from 'ytdlp-nodejs';
import path from 'path';

async function downloadSubtitles(videoUrl, outputDir, options = {}) {
  const ytdlp = new YtDlp();
  const langs = options.languages || ['en'];

  const builder = ytdlp
    .download(videoUrl)
    .skipDownload()           // Don't download video
    .writeSubs()              // Download manual subtitles
    .writeAutoSubs()          // Also get auto-generated if no manual
    .subLangs(langs)          // Specify languages
    .output(outputDir)
    .setOutputTemplate('%(title)s.%(ext)s');

  // Add option to convert to VTT format for consistency
  builder.addOption('--convert-subs', 'vtt');

  return await builder.run();
}
```

### 4. Subtitle Parsing (`parser.js`)

```javascript
import subsrt from 'subsrt';
import fs from 'fs/promises';

async function subtitleToText(subtitlePath) {
  const content = await fs.readFile(subtitlePath, 'utf-8');

  // Parse subtitle file (auto-detects format)
  const captions = subsrt.parse(content);

  // Extract plain text from each caption
  const textLines = captions
    .filter(cap => cap.type === 'caption')
    .map(cap => cap.text)
    .filter(text => text && text.trim());

  // Join with single newline, remove duplicate consecutive lines
  const uniqueLines = textLines.filter((line, i, arr) =>
    i === 0 || line !== arr[i - 1]
  );

  return uniqueLines.join('\n');
}

async function convertAndSave(subtitlePath, outputPath) {
  const text = await subtitleToText(subtitlePath);
  await fs.writeFile(outputPath, text, 'utf-8');

  // Optionally delete the original VTT file
  await fs.unlink(subtitlePath);

  return outputPath;
}
```

### 5. CLI Interface (`index.js`)

```javascript
#!/usr/bin/env node
import { Command } from 'commander';
import { downloadAllSubtitles } from './downloader.js';
import ora from 'ora';
import chalk from 'chalk';

const program = new Command();

program
  .name('yt-sub-dl')
  .description('Download YouTube subtitles as plain text')
  .version('1.0.0')
  .argument('<url>', 'YouTube video, playlist, or channel URL')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-l, --langs <langs>', 'Subtitle languages (comma-separated)', 'en')
  .option('--auto-only', 'Only download auto-generated subtitles')
  .option('--keep-original', 'Keep original VTT/SRT files')
  .action(async (url, options) => {
    const spinner = ora('Fetching video information...').start();

    try {
      const langs = options.langs.split(',');
      const result = await downloadAllSubtitles(url, {
        outputDir: options.output,
        languages: langs,
        autoOnly: options.autoOnly,
        keepOriginal: options.keepOriginal
      });

      spinner.succeed(chalk.green(`Downloaded ${result.count} subtitle(s)`));
    } catch (error) {
      spinner.fail(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
```

---

## Main Workflow (`downloader.js`)

```javascript
import { detectUrlType, getVideoList } from './extractor.js';
import { convertAndSave } from './parser.js';
import { YtDlp } from 'ytdlp-nodejs';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export async function downloadAllSubtitles(url, options) {
  const urlType = detectUrlType(url);
  let videos = [];

  // Get video list based on URL type
  if (urlType === 'video') {
    const ytdlp = new YtDlp();
    const info = await ytdlp.getInfoAsync(url);
    videos = [{ id: info.id, title: info.title, url }];
  } else {
    videos = await getVideoList(url);
  }

  console.log(`Found ${videos.length} video(s)`);

  const results = [];

  for (const video of videos) {
    try {
      // Create safe filename
      const safeTitle = video.title
        .replace(/[<>:"/\\|?*]/g, '-')
        .substring(0, 100);

      const videoOutputDir = path.join(options.outputDir, safeTitle);
      await fs.mkdir(videoOutputDir, { recursive: true });

      // Download subtitles
      await downloadSubtitles(video.url, videoOutputDir, {
        languages: options.languages
      });

      // Find and convert downloaded subtitle files
      const subtitleFiles = await glob(`${videoOutputDir}/*.vtt`);

      for (const subFile of subtitleFiles) {
        const txtPath = subFile.replace(/\.vtt$/, '.txt');
        await convertAndSave(subFile, txtPath);
        results.push(txtPath);
      }

      console.log(`✓ ${video.title}`);
    } catch (error) {
      console.error(`✗ ${video.title}: ${error.message}`);
    }
  }

  return { count: results.length, files: results };
}
```

---

## Usage Examples

```bash
# Single video
npx yt-sub-dl https://www.youtube.com/watch?v=VIDEO_ID

# Playlist
npx yt-sub-dl https://www.youtube.com/playlist?list=PLAYLIST_ID -o ./subs

# Channel (all videos)
npx yt-sub-dl https://www.youtube.com/@ChannelName -l en,fa

# With options
npx yt-sub-dl URL --output ./downloads --langs en,es --keep-original
```

---

## Alternative Approach: Direct yt-dlp Command

If you prefer a simpler approach, you can spawn yt-dlp directly:

```javascript
import { spawn } from 'child_process';

function downloadSubsWithYtDlp(url, outputDir, langs = 'en') {
  return new Promise((resolve, reject) => {
    const args = [
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', langs,
      '--convert-subs', 'vtt',
      '-o', `${outputDir}/%(title)s.%(ext)s`,
      url
    ];

    const proc = spawn('yt-dlp', args);

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}`));
    });
  });
}
```

---

## Next Steps

1. Initialize npm project: `npm init -y`
2. Install dependencies:
   ```bash
   npm install ytdlp-nodejs subsrt commander ora chalk glob
   ```
3. Install yt-dlp system-wide:
   ```bash
   brew install yt-dlp ffmpeg  # macOS
   # or
   pip install yt-dlp          # Python
   ```
4. Create the source files as outlined above
5. Add to `package.json`:
   ```json
   {
     "type": "module",
     "bin": {
       "yt-sub-dl": "./src/index.js"
     }
   }
   ```

---

## Sources

- [ytdlp-nodejs](https://github.com/iqbal-rashed/ytdlp-nodejs) - Node.js wrapper for yt-dlp
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Feature-rich command-line audio/video downloader
- [subsrt](https://github.com/papnkukn/subsrt) - Subtitle converter and parser
- [yt-dlp Complete Guide](https://www.rapidseedbox.com/blog/yt-dlp-complete-guide) - Comprehensive yt-dlp usage guide
- [yt-dlp Subtitle Commands](https://www.blackmoreops.com/yt-dlp-commands-for-subtitles-codec/) - Subtitle-specific commands
