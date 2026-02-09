# NanoCloud - API Documentation

**Last Updated**: February 9, 2026  
**Version**: 3.0  
**Audience**: Developers, Integrators

---

## Overview

NanoCloud provides a RESTful-style API for file management operations. All API endpoints are accessed through `api.php` using query parameters and POST data.

### Base URL

```
http://your-server/api.php
```

### Request Format

- **Method**: GET or POST (depending on operation)
- **Content-Type**: `application/x-www-form-urlencoded` or `multipart/form-data` (for uploads)
- **Response Format**: JSON

### Response Structure

All API responses include a `storage` object with disk usage information:

```json
{
  "success": true|false,
  "message": "Human-readable message",
  // ... endpoint-specific fields ...
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

---

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [System Info](#system-info)
  - [List Directory](#list-directory)
  - [Upload File](#upload-file)
  - [Upload Chunk](#upload-chunk)
  - [Upload Check](#upload-check)
  - [Delete File](#delete-file)
  - [Rename File](#rename-file)
  - [Move Item](#move-item)
  - [Create Directory](#create-directory)
  - [Delete Directory](#delete-directory)
  - [Rename Directory](#rename-directory)
- [JavaScript Client](#javascript-client)
- [Examples](#examples)

---

## Authentication

By default, NanoCloud has **no authentication**. If you've added authentication (Basic Auth, OAuth, etc.), include credentials with each request.

### Basic Authentication

```bash
curl -u username:password http://your-server/api.php?action=info
```

### OAuth/Bearer Token

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://your-server/api.php?action=info
```

---

## Error Handling

### HTTP Status Codes

- `200 OK` - Request successful (check `success` field in JSON)
- `500 Internal Server Error` - Server error

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

### Common Error Messages

- `"Unknown action."` - Invalid action parameter
- `"Missing filename."` - Required parameter missing
- `"Target path not found."` - Directory doesn't exist
- `"Operation not allowed."` - Feature disabled in config
- `"Insufficient disk space on server."` - Storage full

---

## Endpoints

### System Info

Get system configuration and operation permissions.

**Endpoint**: `GET /api.php?action=info`

**Parameters**: None

**Response**:
```json
{
  "success": true,
  "readOnly": false,
  "uploadEnabled": true,
  "deleteEnabled": true,
  "renameEnabled": true,
  "moveEnabled": true,
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl http://your-server/api.php?action=info
```

---

### List Directory

List contents of a directory.

**Endpoint**: `GET /api.php?action=list&path={path}`

**Parameters**:
- `path` (string, optional) - Relative path to list (default: root)

**Response**:
```json
{
  "success": true,
  "message": "OK",
  "items": [
    {
      "name": "Documents",
      "type": "dir",
      "mtime": 1704067200,
      "count": 5
    },
    {
      "name": "photo.jpg",
      "type": "file",
      "size": 2048576,
      "mtime": 1704067200
    }
  ],
  "path": "uploads/2024",
  "breadcrumbs": [
    {"name": "Home", "path": ""},
    {"name": "uploads", "path": "uploads"},
    {"name": "2024", "path": "uploads/2024"}
  ],
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
# List root directory
curl http://your-server/api.php?action=list

# List subdirectory
curl "http://your-server/api.php?action=list&path=uploads/2024"
```

---

### Upload File

Upload one or more files (standard upload for files < 100MB).

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=upload` (required)
- `path` (string, optional) - Target directory path
- `files[]` (file, required) - File(s) to upload
- `relativePaths[]` (array, optional) - Relative paths for folder uploads

**Response**:
```json
{
  "success": true,
  "message": "Upload processed.",
  "results": [
    {
      "filename": "document.pdf",
      "success": true,
      "message": "File uploaded successfully."
    },
    {
      "filename": "photo.jpg",
      "success": true,
      "message": "File uploaded successfully."
    }
  ],
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Per-File Result**:
- `filename` - Original or sanitized filename
- `success` - Boolean indicating if this file uploaded successfully
- `message` - Success or error message for this file

**Example**:
```bash
curl -X POST \
  -F "action=upload" \
  -F "path=uploads/2024" \
  -F "files[]=@/path/to/file.pdf" \
  -F "files[]=@/path/to/photo.jpg" \
  http://your-server/api.php
```

**JavaScript Example**:
```javascript
const formData = new FormData();
formData.append('action', 'upload');
formData.append('path', 'uploads/2024');
formData.append('files[]', fileInput.files[0]);
formData.append('files[]', fileInput.files[1]);

const response = await fetch('api.php', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.results); // Array of per-file results
```

---

### Upload Chunk

Upload a file chunk (for large files > 100MB).

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=upload_chunk` (required)
- `uploadId` (string, required) - Unique identifier for this upload session
- `chunkIndex` (integer, required) - Chunk index (0-based)
- `totalChunks` (integer, required) - Total number of chunks
- `filename` (string, required) - Original filename
- `relativePath` (string, optional) - Relative path for folder uploads
- `path` (string, optional) - Target directory path
- `chunk` (file, required) - Chunk data

**Intermediate Chunk Response**:
```json
{
  "success": true,
  "message": "Chunk received.",
  "chunkIndex": 0,
  "totalChunks": 10
}
```

**Final Chunk Response** (when all chunks received):
```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "filename": "large-video.mp4",
  "size": 524288000,
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```javascript
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
// Use deterministic ID for resumability (hash of filename + size + mtime)
const uploadId = '7d2f9a1b'; // Example deterministic ID
const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

for (let i = 0; i < totalChunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunk = file.slice(start, end);
  
  const formData = new FormData();
  formData.append('action', 'upload_chunk');
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', i);
  formData.append('totalChunks', totalChunks);
  formData.append('filename', file.name);
  formData.append('path', targetPath);
  formData.append('chunk', chunk);
  
  const response = await fetch('api.php', { method: 'POST', body: formData });
  const result = await response.json();
  
  if (i === totalChunks - 1) {
    console.log('Upload complete!', result.filename, result.size);
  }
}
```

---

### Upload Check

Check status of a resumable upload (for resuming interrupted uploads).

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=upload_check` (required)
- `uploadId` (string, required) - Upload session identifier

**Response (No Existing Upload)**:
```json
{
  "success": true,
  "exists": false,
  "nextChunkIndex": 0,
  "message": "No existing upload found."
}
```

**Response (Existing Upload Found)**:
```json
{
  "success": true,
  "exists": true,
  "nextChunkIndex": 5,
  "message": "Found 5 existing chunks."
}
```

**Example**:
```bash
curl -X POST \
  -d "action=upload_check" \
  -d "uploadId=upload-1234567890-abc123" \
  http://your-server/api.php
```

**JavaScript Example**:
```javascript
const formData = new FormData();
formData.append('action', 'upload_check');
formData.append('uploadId', uploadId);

const response = await fetch('api.php', { method: 'POST', body: formData });
const result = await response.json();

if (result.exists) {
  console.log(`Resume from chunk ${result.nextChunkIndex}`);
} else {
  console.log('Start new upload');
}
```

---

### Delete File

Delete a file.

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=delete` (required)
- `path` (string, required) - Directory path
- `filename` (string, required) - Filename to delete

**Response**:
```json
{
  "success": true,
  "message": "File deleted.",
  "filename": "document.pdf",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl -X POST \
  -d "action=delete" \
  -d "path=uploads/2024" \
  -d "filename=document.pdf" \
  http://your-server/api.php
```

---

### Rename File

Rename a file.

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=rename_file` (required)
- `path` (string, required) - Directory path
- `filename` (string, required) - Current filename
- `newName` (string, required) - New filename

**Response**:
```json
{
  "success": true,
  "message": "File renamed.",
  "filename": "old.pdf",
  "newName": "new.pdf",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl -X POST \
  -d "action=rename_file" \
  -d "path=uploads/2024" \
  -d "filename=old.pdf" \
  -d "newName=new.pdf" \
  http://your-server/api.php
```

---

### Move Item

Move a file or directory to a different location.

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=move` (required)
- `path` (string, required) - Source directory path
- `itemType` (string, required) - Item type: `"file"` or `"dir"`
- `itemName` (string, required) - Item name to move
- `targetPath` (string, required) - Target directory path

**Response**:
```json
{
  "success": true,
  "message": "Item moved successfully.",
  "itemType": "file",
  "itemName": "document.pdf",
  "fromPath": "uploads/2024",
  "toPath": "archive/2024",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl -X POST \
  -d "action=move" \
  -d "path=uploads/2024" \
  -d "itemType=file" \
  -d "itemName=document.pdf" \
  -d "targetPath=archive/2024" \
  http://your-server/api.php
```

---

### Create Directory

Create a new directory.

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=create_dir` (required)
- `path` (string, required) - Parent directory path
- `name` (string, required) - New directory name

**Response**:
```json
{
  "success": true,
  "message": "Directory created.",
  "name": "Projects",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl -X POST \
  -d "action=create_dir" \
  -d "path=uploads" \
  -d "name=Projects" \
  http://your-server/api.php
```

---

### Delete Directory

Delete a directory recursively.

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=delete_dir` (required)
- `path` (string, required) - Parent directory path
- `name` (string, required) - Directory name to delete

**Response**:
```json
{
  "success": true,
  "message": "Directory deleted.",
  "name": "OldProjects",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl -X POST \
  -d "action=delete_dir" \
  -d "path=uploads" \
  -d "name=OldProjects" \
  http://your-server/api.php
```

---

### Rename Directory

Rename a directory.

**Endpoint**: `POST /api.php`

**Parameters**:
- `action=rename_dir` (required)
- `path` (string, required) - Parent directory path
- `name` (string, required) - Current directory name
- `newName` (string, required) - New directory name

**Response**:
```json
{
  "success": true,
  "message": "Directory renamed.",
  "name": "Projects",
  "newName": "ActiveProjects",
  "storage": {
    "totalBytes": 2112611565568,
    "freeBytes": 825860231168,
    "usedBytes": 1286751334400,
    "usedPercent": 60.908089086128
  }
}
```

**Example**:
```bash
curl -X POST \
  -d "action=rename_dir" \
  -d "path=uploads" \
  -d "name=Projects" \
  -d "newName=ActiveProjects" \
  http://your-server/api.php
```

---

## JavaScript Client

NanoCloud includes a JavaScript client (`nanocloudClient.js`) for easy API integration.

### Import

```javascript
import { nanocloudClient } from './assets/js/nanocloudClient.js';
```

### Methods

#### List Directory

```javascript
const result = await nanocloudClient.list('uploads/2024');
console.log(result.items);
console.log(result.storage);
```

#### Upload File

```javascript
const file = document.querySelector('input[type="file"]').files[0];
const result = await nanocloudClient.upload(file, 'uploads/2024', (progress) => {
  console.log(`Upload progress: ${progress}%`);
});

// Check individual file results
result.results.forEach(fileResult => {
  if (fileResult.success) {
    console.log(`✓ ${fileResult.filename} uploaded`);
  } else {
    console.error(`✗ ${fileResult.filename}: ${fileResult.message}`);
  }
});
```

#### Upload with Chunking

```javascript
const result = await nanocloudClient.uploadChunked(
  largeFile,
  'uploads/2024',
  (progress) => console.log(`${progress}%`)
);

console.log(`Uploaded: ${result.filename}, Size: ${result.size} bytes`);
```

#### Delete File

```javascript
await nanocloudClient.deleteFile('uploads/2024', 'document.pdf');
```

#### Rename File

```javascript
await nanocloudClient.renameFile('uploads/2024', 'old.pdf', 'new.pdf');
```

#### Move Item

```javascript
await nanocloudClient.moveItem('uploads/2024', 'file', 'document.pdf', 'archive/2024');
```

#### Create Directory

```javascript
await nanocloudClient.createDirectory('uploads', 'NewFolder');
```

#### Delete Directory

```javascript
await nanocloudClient.deleteDirectory('uploads', 'OldFolder');
```

#### Rename Directory

```javascript
await nanocloudClient.renameDirectory('uploads', 'OldName', 'NewName');
```

---

## Examples

### Complete Upload Example with Error Handling

```javascript
async function uploadFiles(files, targetPath) {
  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('path', targetPath);
  
  for (const file of files) {
    formData.append('files[]', file);
  }
  
  try {
    const response = await fetch('api.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Upload failed:', result.message);
      return;
    }
    
    // Process per-file results
    const successful = result.results.filter(r => r.success);
    const failed = result.results.filter(r => !r.success);
    
    console.log(`✓ ${successful.length} files uploaded`);
    if (failed.length > 0) {
      console.error(`✗ ${failed.length} files failed:`);
      failed.forEach(f => console.error(`  - ${f.filename}: ${f.message}`));
    }
    
    // Display storage info
    const storage = result.storage;
    console.log(`Storage: ${storage.usedPercent.toFixed(1)}% used`);
    
  } catch (error) {
    console.error('Network error:', error);
  }
}
```

### Chunked Upload with Resume Support

```javascript
async function uploadLargeFile(file, targetPath) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  
  // Generate deterministic upload ID based on file metadata
  // This ensures the same ID is generated if the upload is retried
  const metadata = `${file.name}-${file.size}-${file.lastModified}-${targetPath}`;
  let hash = 0;
  for (let i = 0; i < metadata.length; i++) {
    hash = ((hash << 5) - hash) + metadata.charCodeAt(i);
    hash = hash & hash;
  }
  const uploadId = (hash >>> 0).toString(16).padStart(8, '0');
  
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // Check for existing upload
  const checkData = new FormData();
  checkData.append('action', 'upload_check');
  checkData.append('uploadId', uploadId);
  
  const checkResponse = await fetch('api.php', { method: 'POST', body: checkData });
  const checkResult = await checkResponse.json();
  
  const startChunk = checkResult.exists ? checkResult.nextChunkIndex : 0;
  console.log(`Starting from chunk ${startChunk} of ${totalChunks}`);
  
  // Upload chunks
  for (let i = startChunk; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('action', 'upload_chunk');
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i);
    formData.append('totalChunks', totalChunks);
    formData.append('filename', file.name);
    formData.append('path', targetPath);
    formData.append('chunk', chunk);
    
    const response = await fetch('api.php', { method: 'POST', body: formData });
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Chunk ${i} failed: ${result.message}`);
    }
    
    const progress = ((i + 1) / totalChunks * 100).toFixed(1);
    console.log(`Progress: ${progress}%`);
    
    // Final chunk includes filename and size
    if (i === totalChunks - 1) {
      console.log(`✓ Upload complete: ${result.filename} (${result.size} bytes)`);
      return result;
    }
  }
}
```

### File Browser with Storage Display

```javascript
async function browseDirectory(path = '') {
  try {
    const response = await fetch(`api.php?action=list&path=${encodeURIComponent(path)}`);
    const result = await response.json();
    
    if (!result.success) {
      console.error('Failed to list directory:', result.message);
      return;
    }
    
    // Display breadcrumbs
    console.log('Path:', result.breadcrumbs.map(c => c.name).join(' / '));
    
    // Display items
    result.items.forEach(item => {
      if (item.type === 'dir') {
        console.log(`📁 ${item.name} (${item.count} items)`);
      } else {
        const size = formatBytes(item.size);
        console.log(`📄 ${item.name} (${size})`);
      }
    });
    
    // Display storage
    const s = result.storage;
    const used = formatBytes(s.usedBytes);
    const total = formatBytes(s.totalBytes);
    console.log(`\nStorage: ${used} / ${total} (${s.usedPercent.toFixed(1)}% used)`);
    
  } catch (error) {
    console.error('Network error:', error);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}
```

---

## Best Practices

### Error Handling

Always check the `success` field:

```javascript
const response = await fetch('api.php?action=list');
const data = await response.json();

if (!data.success) {
  console.error('API Error:', data.message);
  return;
}

// Process data
```

### Storage Monitoring

Monitor storage usage to prevent disk full errors:

```javascript
function checkStorage(storage) {
  if (storage.usedPercent > 90) {
    alert('Warning: Storage is 90% full!');
  }
}

// After any operation
const result = await nanocloudClient.list();
checkStorage(result.storage);
```

### Retry Logic

Implement retry logic for network failures:

```javascript
async function apiCallWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Usage
const result = await apiCallWithRetry(() => 
  nanocloudClient.upload(file, path)
);
```

---

## Support

For API questions or issues:
- **Documentation**: [GitHub Wiki](https://github.com/souvikranju/nanocloud/wiki)
- **Issues**: [GitHub Issues](https://github.com/souvikranju/nanocloud/issues)
- **Discussions**: [GitHub Discussions](https://github.com/souvikranju/nanocloud/discussions)

---

## Changelog

### Version 2.0 (2026-01-21)
- Added chunked upload support
- Added upload resumability (upload_check)
- Added move operation
- Improved error handling
- Added storage info to all responses

### Version 1.0 (2025-01-01)
- Initial API release
- Basic CRUD operations
- Directory management

---

**See Also**:
- [Architecture Documentation](ARCHITECTURE.md)
- [Security Guide](SECURITY.md)
