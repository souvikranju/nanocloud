# In-Browser Streaming Support

This document describes the in-browser streaming capabilities of NanoCloud and the optimizations implemented to maximize media playback support.

## Overview

NanoCloud now supports in-browser streaming for a wide range of media formats. When users click on supported media files, they open directly in the browser's native media player instead of forcing a download.

## Supported Formats

### Video Formats
- **MP4** (`.mp4`) - Universal support across all modern browsers
- **WebM** (`.webm`) - Widely supported, especially in Chrome/Firefox
- **Ogg** (`.ogg`, `.ogv`) - Supported in Firefox and Chrome
- **QuickTime** (`.mov`) - Native support in Safari, good support in Chrome
- **M4V** (`.m4v`) - iTunes video format, essentially MP4
- **3GP** (`.3gp`) - Mobile video format, partial browser support
- **Matroska** (`.mkv`) - Container format, support varies by codecs

### Audio Formats
- **MP3** (`.mp3`) - Universal support
- **WAV** (`.wav`) - Uncompressed audio, universal support
- **FLAC** (`.flac`) - Lossless audio, widely supported
- **AAC** (`.aac`) - Advanced Audio Coding, widely supported
- **M4A** (`.m4a`) - MPEG-4 audio, widely supported
- **Ogg Vorbis** (`.ogg`, `.oga`) - Open format, good support
- **Opus** (`.opus`) - Modern codec, growing support

### Image Formats
- **JPEG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`)
- **GIF** (`.gif`)
- **WebP** (`.webp`)
- **BMP** (`.bmp`)
- **SVG** (`.svg`)

### Document Formats
- **PDF** (`.pdf`) - Inline viewing in most browsers
- **Text** (`.txt`) - Plain text viewing
- **HTML** (`.html`, `.htm`) - Web pages
- **CSS** (`.css`) - Stylesheets
- **JavaScript** (`.js`) - Code viewing
- **JSON** (`.json`) - Data viewing
- **XML** (`.xml`) - Markup viewing

## Technical Implementation

### Backend (PHP)

The `public/download.php` file implements:

1. **Extension-Based MIME Type Mapping**: A comprehensive mapping ensures correct MIME types are sent to browsers, even when PHP's `mime_content_type()` returns generic types.

2. **HTTP Range Request Support**: Critical for video/audio seeking. The server responds with `206 Partial Content` when browsers request specific byte ranges.

3. **Proper Headers**:
   - `Content-Type`: Correct MIME type for the file
   - `Content-Disposition: inline`: Tells browser to display, not download
   - `Accept-Ranges: bytes`: Enables seeking in media players
   - `Cache-Control`: Optimizes repeated access

4. **Streaming with Chunked Transfer**: Files are streamed in 8KB chunks to handle large files efficiently without loading them entirely into memory.

### Frontend (JavaScript)

The `public/assets/js/ui/fileIcons.js` file implements:

1. **Viewability Detection**: The `isViewableInBrowser()` function determines which files should open in the browser vs. force download.

2. **Smart Opening**: Files marked as viewable open in a new tab with `target="_blank"`, allowing the browser's native player to handle them.

3. **Force Download List**: Only truly incompatible formats (AVI, WMV, FLV) and executables are forced to download.

## Browser Compatibility

### Excellent Support (All Modern Browsers)
- MP4, WebM (VP8/VP9)
- MP3, AAC, WAV
- JPEG, PNG, GIF, WebP
- PDF

### Good Support (Most Browsers)
- MOV (Safari native, Chrome/Edge good)
- M4V, M4A
- FLAC, Opus
- SVG

### Partial Support (Depends on Codecs)
- **MKV**: Chrome/Edge may play if it contains VP8/VP9 video and Vorbis/Opus audio (WebM-compatible codecs). Otherwise, may fail or prompt download.
- **3GP**: Older mobile format, limited support
- **OGG Video**: Firefox and Chrome support, Safari does not

## Limitations

1. **Codec Dependency**: Container formats like MKV can contain various codecs. Browsers only support specific codecs:
   - Chrome/Edge: H.264, VP8, VP9, AV1
   - Firefox: H.264, VP8, VP9, AV1, Theora
   - Safari: H.264, HEVC (on supported devices)

2. **No Transcoding**: NanoCloud serves files as-is. If a browser cannot decode the file's codecs, playback will fail.

3. **Large Files**: While streaming is efficient, very large files (>1GB) may take time to buffer initially.

4. **Mobile Browsers**: Mobile browsers may have additional restrictions on autoplay and background playback.

## Configuration

### Rate Limiting

You can configure download rate limiting in `config/local.php`:

```php
'DOWNLOAD_RATE_LIMIT_MB' => 0, // 0 = unlimited, or set MB/s limit
```

This affects streaming performance. For local networks, keep it at 0 (unlimited).

### Disabling In-Browser Viewing

If you prefer to force downloads for all media files, modify `public/assets/js/ui/fileIcons.js`:

```javascript
export function isViewableInBrowser(filename) {
  return false; // Force download for everything
}
```

## Testing Streaming

1. Upload a test video file (MP4 recommended for universal compatibility)
2. Click on the file in the file list
3. The file should open in a new browser tab with the native video player
4. Test seeking (clicking different positions in the timeline)
5. Test pause/play functionality

## Troubleshooting

### Video Won't Play
- **Check codec**: Use `ffprobe` or MediaInfo to verify the file's codecs
- **Try different browser**: Safari, Chrome, and Firefox have different codec support
- **Check MIME type**: Open browser DevTools → Network tab → Check the `Content-Type` header

### Video Downloads Instead of Playing
- **Verify extension is in whitelist**: Check `isViewableInBrowser()` in `fileIcons.js`
- **Check MIME type mapping**: Verify the extension is in `getMimeTypeForFile()` in `download.php`

### Seeking Doesn't Work
- **Verify Range support**: Check that `Accept-Ranges: bytes` header is present
- **Check server config**: Some reverse proxies may interfere with range requests

### Playback is Choppy
- **Check rate limiting**: Ensure `DOWNLOAD_RATE_LIMIT_MB` is not too restrictive
- **Network speed**: Verify network bandwidth is sufficient
- **File bitrate**: Very high bitrate files may exceed network capacity

## Future Enhancements

Potential improvements for even better streaming support:

1. **Dedicated Media Viewer Page**: Create a custom player page with Video.js or similar library for enhanced controls and format support
2. **Thumbnail Generation**: Generate video thumbnails for preview
3. **Subtitle Support**: Add support for external subtitle files (.srt, .vtt)
4. **Playlist Support**: Allow sequential playback of multiple media files
5. **Server-Side Transcoding**: Convert incompatible formats on-the-fly (requires FFmpeg)
6. **Adaptive Streaming**: Implement HLS or DASH for better quality adaptation

## Security Considerations

- All file access goes through path validation and sanitization
- MIME types are explicitly set to prevent MIME-sniffing attacks
- Range requests are validated to prevent out-of-bounds access
- Rate limiting can prevent bandwidth abuse

## Performance Tips

1. **Use MP4 for videos**: Best compatibility and performance
2. **Use MP3 for audio**: Universal support and good compression
3. **Optimize file sizes**: Compress media before uploading
4. **Enable caching**: The `Cache-Control` header allows browser caching
5. **Use CDN**: For public deployments, consider a CDN for media files
