# Chunked Upload Implementation Summary

## Overview
This document summarizes the implementation of **resumable** chunked file uploads in NanoCloud, enabling unlimited file size uploads by bypassing PHP's `upload_max_filesize` and `post_max_size` limitations. Uploads can be resumed from any device if interrupted.

## Files Modified

### 1. Documentation
- **`docs/CHUNKED_UPLOAD.md`** (NEW)
  - Comprehensive documentation of the chunked upload strategy
  - Architecture flow diagrams
  - Security measures
  - Configuration options
  - Testing checklist

- **`docs/ARCHITECTURE.md`** (UPDATED)
  - Added reference to chunked upload flow
  - Updated "Upload File" section with both standard and chunked upload flows

### 2. Backend Changes

#### `public/api.php`
- Added `upload_chunk` action to the router
- Added `upload_check` action for resumability
- Created `handleUploadChunk()` function to process chunk upload requests
- Created `handleUploadCheck()` function to check upload status
- Validates chunk parameters and delegates to `UploadService`

#### `src/Services/UploadService.php`
- **New Method: `checkUploadStatus()`**
  - Validates uploadId format
  - Checks if chunk directory exists
  - Counts sequential chunks (0, 1, 2, ...)
  - Returns next chunk index to upload
  - Enables resume functionality

- **New Method: `handleChunk()`**
  - Validates uploadId (alphanumeric + hyphens only)
  - Validates chunk parameters (index, total)
  - Saves chunks to `storage/temp/chunks/{uploadId}/{index}.part`
  - Triggers merge when last chunk received
  - Cleans up stale chunks on first chunk (index 0)

- **New Method: `mergeChunks()`**
  - Verifies all chunks exist
  - Creates final file with streaming merge (memory efficient)
  - Validates final file size
  - Applies permissions
  - Cleans up chunk directory

- **New Method: `cleanupStaleChunks()`**
  - Scans for chunk directories older than 2 hours
  - Deletes stale uploads automatically
  - Runs on first chunk of any new upload

- **New Method: `cleanupUploadDirectory()`**
  - Recursively deletes upload directory and contents
  - Called on errors or after successful merge

### 3. Frontend Changes

#### `public/assets/js/constants.js`
- Added `CHUNK_SIZE = 2 * 1024 * 1024` (2MB)
- Added `CHUNKED_UPLOAD_THRESHOLD = CHUNK_SIZE`
- Added `MAX_CHUNK_RETRIES = 3`

#### `public/assets/js/nanocloudClient.js`
- **New Function: `uploadChunk()`** (private)
  - Sends a single chunk via XHR POST
  - Returns promise with server response

- **New Function: `uploadChunked()`** (exported)
  - Generates unique uploadId
  - Slices file into chunks
  - Uploads chunks sequentially
  - Implements retry logic (3 attempts per chunk)
  - Reports progress after each chunk
  - Returns final result after last chunk

#### `public/assets/js/uploader.js`
- Updated imports to include `CHUNK_SIZE`, `CHUNKED_UPLOAD_THRESHOLD`, and `uploadChunked`
- Modified `worker()` function to:
  - Check file size against `CHUNKED_UPLOAD_THRESHOLD`
  - Use `uploadChunked()` for large files (> 2MB)
  - Use `uploadSingle()` for small files (≤ 2MB)
  - Maintain backward compatibility

## Resumability Features

### Deterministic Upload ID
- **Algorithm**: SHA-256 hash of file metadata
- **Input**: `filename + size + lastModified + targetPath + relativePath`
- **Result**: Same file = same ID across all devices
- **Example**: `a3f5e8d9c2b1...` (64-character hex string)

### Resume Flow
1. User starts upload (generates deterministic ID)
2. Upload interrupted (network drop, browser crash, etc.)
3. User reopens application (same or different device)
4. Drops same file again
5. System generates same ID
6. Calls `upload_check` API
7. Server responds with `nextChunkIndex`
8. Upload resumes from that point

### Cross-Device Compatibility
- Upload started on Device A
- Continued on Device B
- Completed on Device C
- All devices use the same deterministic `uploadId`
- No server-side session dependency

### Automatic Cleanup
- Incomplete uploads deleted after 2 hours of inactivity
- Timer resets with each new chunk upload
- Directory modification time used for tracking
- No manual intervention required

## Key Features

### 1. Automatic Selection
- Files ≤ 2MB: Standard upload (single request)
- Files > 2MB: Chunked upload (multiple requests)
- Transparent to the user

### 2. Resumability
- **Cross-device**: Resume from any device with the same file
- **Automatic detection**: System checks for existing chunks before uploading
- **Progress preservation**: UI instantly reflects already-uploaded chunks
- **No user action**: Resume happens automatically

### 3. Security
- UploadId validation (alphanumeric + hyphens only)
- Path traversal prevention
- Connection abort detection
- Automatic cleanup of orphaned chunks

### 3. Reliability
- Retry logic: 3 attempts per chunk with exponential backoff
- Sequential chunk upload (prevents race conditions)
- File integrity verification (size check after merge)
- Atomic operations

### 4. Memory Efficiency
- Stream-based merging (8KB buffer)
- No need to load entire file into memory
- Chunks processed one at a time

### 5. Cleanup Strategy
- **Active**: Detects connection abort during chunk upload
- **Passive**: Scans for stale chunks (> 2 hours) on new uploads
- **No external processes**: All cleanup happens within PHP

## Configuration

### Chunk Size
Default: 2MB (`public/assets/js/constants.js`)
```javascript
export const CHUNK_SIZE = 2 * 1024 * 1024;
```

### Chunk Temporary Directory
Default: System temp + `/nanocloud-chunks` (`config/defaults.php`)
```php
$CHUNK_TEMP_DIR = sys_get_temp_dir() . '/nanocloud-chunks';
```

**Configurable in:** `config/local.php`

**Examples:**
- SSD storage: `/mnt/ssd/nanocloud-chunks`
- RAM disk: `/dev/shm/nanocloud-chunks`
- Custom location: `/var/tmp/nanocloud-chunks`

### Stale Threshold
Default: 2 hours (`config/defaults.php`)
```php
$CHUNK_STALE_HOURS = 2;
```

**Configurable in:** `config/local.php`

**Examples:**
- Aggressive cleanup: `$CHUNK_STALE_HOURS = 1;`
- Lenient cleanup: `$CHUNK_STALE_HOURS = 4;`
- Keep for a day: `$CHUNK_STALE_HOURS = 24;`

### Retry Attempts
Default: 3 (`public/assets/js/constants.js`)
```javascript
export const MAX_CHUNK_RETRIES = 3;
```

## API Endpoints

### New Endpoint: `upload_chunk`
**Request Parameters:**
- `action`: `upload_chunk`
- `uploadId`: Unique identifier (alphanumeric + hyphens)
- `chunkIndex`: Current chunk number (0-based)
- `totalChunks`: Total number of chunks
- `filename`: Original filename
- `relativePath`: Relative path for folder uploads
- `path`: Target directory path
- `chunk`: Binary chunk data (File/Blob)

**Response (Intermediate Chunk):**
```json
{
  "success": true,
  "message": "Chunk received.",
  "chunkIndex": 5,
  "totalChunks": 10
}
```

**Response (Final Chunk):**
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "filename": "path/to/file.txt",
  "size": 10485760,
  "storage": { ... }
}
```

## Testing Recommendations

### Functional Tests
1. Upload small file (< 2MB) - should use standard upload
2. Upload large file (> 2MB) - should use chunked upload
3. Upload folder with mixed file sizes
4. Verify progress tracking accuracy
5. Test connection interruption and resume

### Security Tests
1. Attempt path traversal in uploadId
2. Verify cleanup on connection abort
3. Verify stale data cleanup
4. Test with invalid chunk indices
5. Test with missing chunks

### Edge Cases
1. Upload interrupted at 50%
2. Upload interrupted at 99%
3. Multiple concurrent uploads
4. Disk space exhaustion during merge
5. Permission denied scenarios

## Backward Compatibility

✅ **Fully backward compatible**
- Original `upload` action still works
- Small files continue to use standard upload
- No changes required to existing workflows
- Session limits and permissions still enforced

## Performance Impact

### Positive
- Enables unlimited file size uploads
- Memory efficient (streaming merge)
- Automatic retry on network errors

### Considerations
- Slightly more overhead for files > 2MB (multiple requests)
- Sequential chunk upload (not parallel)
- Temporary disk space usage for chunks

## Future Enhancements

### Potential Improvements
1. Parallel chunk upload (with server-side locking)
2. Resume capability (store chunk metadata)
3. MD5/SHA checksum verification
4. Configurable chunk size per upload
5. Progress persistence across page reloads

---

**Implementation Date:** 2026-02-08  
**Status:** Complete and Ready for Testing
