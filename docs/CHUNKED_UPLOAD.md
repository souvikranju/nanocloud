# Chunked Upload Strategy

## Overview

NanoCloud supports **Resumable Chunked File Uploads** to bypass PHP's `upload_max_filesize` and `post_max_size` limitations. This allows users to upload files of unlimited size by splitting them into small chunks on the client side and reassembling them on the server side. **Uploads can be resumed from any device** if interrupted.

## Architecture

### Client-Side Flow

1. **Initialization**:
   - Client generates a **deterministic** `uploadId` using SHA-256 hash of file metadata
   - Hash includes: filename, size, lastModified timestamp, target path, and relative path
   - Calculates `totalChunks` based on file size and chunk size (2MB default)
   - Slices the file using `File.prototype.slice()`

2. **Resume Check**:
   - Before uploading, client calls `upload_check` with the `uploadId`
   - Server responds with `nextChunkIndex` (number of chunks already uploaded)
   - If chunks exist, upload resumes from that point
   - Progress bar instantly reflects already-uploaded chunks

3. **Upload Loop**:
   - Sends chunks sequentially starting from `nextChunkIndex`
   - Each chunk is sent via `POST` to `api.php?action=upload_chunk`
   - Includes retry logic (up to 3 attempts per chunk)

4. **Progress Tracking**:
   - Progress = `(completedChunks / totalChunks) * 100`
   - Real-time UI updates for each chunk

### Server-Side Flow

```
Browser → api.php (POST chunk)
    ↓
Request::input('action') → 'upload_chunk'
    ↓
handleUploadChunk()
    ↓
UploadService::handleChunk()
    ↓
Validate uploadId, chunkIndex, totalChunks
    ↓
PathValidator::validatePath($targetPath)
    ↓
Save chunk to storage/temp/chunks/{uploadId}/{chunkIndex}.part
    ↓
Is this the last chunk (chunkIndex + 1 == totalChunks)?
    ├─ No: Return success, waiting for more chunks
    └─ Yes: Merge Sequence
        1. Verify all chunks exist (0 to totalChunks - 1)
        2. Create final file at destination
        3. Append each chunk sequentially
        4. Verify final file size
        5. Delete temporary chunks directory
        6. Apply permissions
        7. Return upload complete
```

## Chunk Upload Parameters

Each chunk request includes:
- `action`: `upload_chunk`
- `uploadId`: Unique identifier for this upload session
- `chunkIndex`: Current chunk number (0-based)
- `totalChunks`: Total number of chunks
- `filename`: Original filename
- `relativePath`: Relative path for folder uploads
- `path`: Target directory path
- `chunk`: Binary chunk data (Blob)

## Security & Integrity

### Path Validation
- `uploadId` is validated to contain only alphanumeric characters and hyphens
- Prevents directory traversal attacks within temp storage
- All target paths validated through `PathValidator`

### Connection Monitoring
- Server detects client disconnects using `connection_aborted()`
- If disconnect detected during chunk processing, entire upload directory is deleted
- Prevents orphaned partial uploads

### Stale Data Cleanup
- When a new upload starts (chunk 0), system scans for old chunk directories
- Directories older than 2 hours are automatically deleted
- No external cron jobs or background processes required
- Cleanup is self-contained within PHP upload logic

### File Integrity
- Final file size is verified against expected total
- All chunks must be present before merge begins
- Atomic operations ensure consistency

## Configuration

### Chunk Size
Default: 2MB (2 * 1024 * 1024 bytes)

This size is:
- Small enough to pass through standard PHP limits
- Large enough to be efficient for network transfer
- Configurable in `public/assets/js/constants.js`

### Chunk Temporary Directory
Default: System temp directory + `/nanocloud-chunks`

**Configuration:** `config/local.php`
```php
$CHUNK_TEMP_DIR = '/path/to/temp/chunks';
```

**Use Cases:**
- **SSD/NVMe storage:** Better performance for large uploads
- **RAM disk (`/dev/shm`):** Maximum speed for temporary storage
- **Separate partition:** Isolate temp files from main storage

See [Configuration Guide](CONFIGURATION.md#chunk-temporary-directory) for details.

### Cleanup Threshold
Default: 2 hours

**Configuration:** `config/local.php`
```php
$CHUNK_STALE_HOURS = 2;
```

Chunk directories older than this are considered stale and deleted.
Timer resets each time a new chunk is uploaded.

**Examples:**
- `1` hour: Aggressive cleanup, limited disk space
- `4` hours: More lenient, slow connections
- `24` hours: Keep for a full day, maximum resume flexibility

See [Configuration Guide](CONFIGURATION.md#chunk-stale-hours) for details.

## Error Handling

### Client-Side
- Network errors: Retry up to 3 times per chunk
- Server errors: Display error message and abort upload
- Progress tracking: Reset on failure

### Server-Side
- Missing chunks: Return error, prevent merge
- Disk space: Check before starting merge
- Permission errors: Return structured error response
- Connection abort: Cleanup and rollback

## Performance Considerations

### Memory Efficiency
- Chunks are processed one at a time
- No need to load entire file into memory
- Stream-based merging for large files

### Concurrency
- Client sends chunks sequentially (not parallel)
- Prevents race conditions during merge
- Simplifies server-side logic

### Disk I/O
- Temporary chunks stored in dedicated directory
- Atomic rename for final file placement
- Efficient sequential read/write during merge

## Resumable Uploads

### How Resumability Works

1. **Deterministic Upload ID**:
   - Each file generates the same `uploadId` based on its properties
   - Formula: `SHA-256(filename + size + lastModified + targetPath + relativePath)`
   - Same file on different devices = same ID

2. **Resume Process**:
   - User starts uploading a 1GB file (500 chunks)
   - Upload reaches chunk 250, then connection drops
   - User refreshes page or switches to another device
   - Drops the same file again
   - System detects existing chunks 0-249
   - Upload resumes from chunk 250

3. **Cross-Device Resume**:
   - Upload started on laptop
   - Continued on phone (same file)
   - Completed on tablet
   - All devices use the same `uploadId`

### Resume API

**Endpoint**: `upload_check`

**Request**:
```javascript
{
  action: 'upload_check',
  uploadId: 'abc123...'
}
```

**Response**:
```json
{
  "success": true,
  "exists": true,
  "nextChunkIndex": 250,
  "message": "Found 250 existing chunks."
}
```

### Automatic Cleanup

- Incomplete uploads are automatically deleted after **2 hours** of inactivity
- Timer resets each time a new chunk is uploaded
- No manual cleanup required
- No external cron jobs needed

### Example Scenarios

**Scenario 1: Network Interruption**
- Upload 500MB file (250 chunks)
- Network drops at chunk 100
- Refresh page
- System resumes from chunk 101
- Total time saved: ~40%

**Scenario 2: Device Switch**
- Start upload on desktop (chunks 0-150)
- Close laptop, go mobile
- Open same file on phone
- System detects chunks 0-150
- Continues from chunk 151

**Scenario 3: Browser Crash**
- Upload in progress (chunks 0-300)
- Browser crashes
- Reopen browser
- Drop same file
- Resumes from chunk 301

## Backward Compatibility

The chunked upload system is **fully backward compatible**:
- Original `upload` action still works for small files
- Client automatically chooses chunked upload for files > 2MB
- No changes required to existing upload workflows
- Session limits and permissions still enforced

## Testing Checklist

### Functional Tests
- [ ] Upload small file (< 2MB) - uses original method
- [ ] Upload large file (> 2MB) - uses chunked method
- [ ] Upload folder with mixed file sizes
- [ ] Verify progress tracking accuracy
- [ ] Test retry logic on simulated network failure
- [ ] Verify final file integrity (size, content)

### Security Tests
- [ ] Attempt path traversal in uploadId
- [ ] Verify cleanup on connection abort
- [ ] Verify stale data cleanup
- [ ] Test with invalid chunk indices
- [ ] Test with missing chunks

### Edge Cases
- [ ] Upload interrupted at 50%
- [ ] Upload interrupted at 99%
- [ ] Multiple concurrent uploads
- [ ] Disk space exhaustion during merge
- [ ] Permission denied scenarios

## Troubleshooting

### Chunks Not Merging
- Check that all chunks exist in temp directory
- Verify chunk indices are sequential (0 to N-1)
- Check disk space availability

### Stale Chunks Accumulating
- Verify cleanup logic is running on new uploads
- Check file permissions on temp directory
- Review PHP error logs for cleanup failures

### Upload Fails at Merge
- Check available disk space
- Verify target directory permissions
- Review PHP memory_limit setting

---

**NanoCloud** - Unlimited File Uploads Through Chunking
