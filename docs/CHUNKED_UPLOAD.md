# Chunked Uploads

## Overview

NanoCloud supports **resumable chunked file uploads**, allowing you to upload files of unlimited size by splitting them into smaller pieces. This bypasses standard server file size limits and ensures reliability even on unstable connections.

## Key Features

- **Unlimited File Size**: Upload files larger than the server's `upload_max_filesize` or `post_max_size`.
- **Resumability**: Automatically resume interrupted uploads from the exact point of failure.
- **Cross-Device Support**: Start an upload on one device and finish it on another (must use the exact same file).
- **Smart Detection**: Files larger than 2MB are automatically chunked; smaller files use standard upload.

## How It Works

1. **Splitting**: The browser splits your file into **2MB chunks**.
2. **Uploading**: Chunks are uploaded one by one to the server.
3. **Resuming**: If your connection drops, NanoCloud remembers which chunks were successfully received. When you try uploading the file again, it verifies the existing chunks and resumes instantly from the next missing piece.
4. **Merging**: Once the final chunk is received, the server reconstructs the complete file.

## Configuration (For Admins)

While the defaults work out of the box, you can customize behavior in `config/local.php`:

### Temporary Directory
Store chunks on a separate partition or fast storage (SSD/RAM) for better performance.
```php
$CHUNK_TEMP_DIR = '/path/to/custom/temp/dir';
```

### Cleanup Threshold
Define how long (in hours) to keep incomplete uploads before deleting them. The timer resets with each new chunk received.
```php
$CHUNK_STALE_HOURS = 24; // Keep for 24 hours
```

*Refer to `docs/CONFIGURATION.md` for detailed setup instructions.*

## Troubleshooting

- **Upload Stops or Fails**: simply refresh the page and try uploading the same file again. The system will detect the partial upload and resume.
- **"Server Error" during Finalizing**: Ensure the server has enough disk space to assemble the final file.
- **Permission Errors**: Ensure the web server has write access to the temporary chunk directory (default: system temp) and the target upload directory.
