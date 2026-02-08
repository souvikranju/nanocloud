<?php
/**
 * Upload Service
 * 
 * Handles file uploads with transactional support, including:
 * - Multi-file uploads
 * - Folder structure preservation
 * - Chunked uploads for unlimited file sizes
 * - Rollback on client disconnect
 */

declare(strict_types=1);

namespace NanoCloud\Services;

use NanoCloud\Security\PathValidator;
use NanoCloud\Security\Sanitizer;
use NanoCloud\Core\Config;
use NanoCloud\Core\Request;
use function NanoCloud\Helpers\applyPermissions;
use function NanoCloud\Helpers\checkOperationAllowed;
use function NanoCloud\Helpers\getUploadErrorMessage;
use function NanoCloud\Helpers\ensureDirectoryExists;

class UploadService
{
    private StorageService $storageService;
    private array $inflightFiles = [];
    
    public function __construct()
    {
        $this->storageService = new StorageService();
        
        // Track in-flight temporary files for cleanup
        register_shutdown_function([$this, 'cleanup']);
    }
    
    /**
     * Handle file uploads
     * 
     * @param string $relativePath Target directory path
     * @return array Response with per-file results
     */
    public function handleUpload(string $relativePath): array
    {
        // Check if operation is allowed
        $check = checkOperationAllowed('upload');
        if (!$check['allowed']) {
            return [
                'success' => false,
                'message' => $check['message'],
                'results' => [],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Allow script to continue for cleanup even if client disconnects
        ignore_user_abort(true);
        
        // Get uploaded files
        $files = Request::files('files');
        if ($files === null) {
            return [
                'success' => false,
                'message' => 'No files provided.',
                'results' => [],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Validate target path
        $validated = PathValidator::validatePath($relativePath);
        if ($validated === null) {
            return [
                'success' => false,
                'message' => 'Target path not found.',
                'results' => [],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $targetDir = $validated['absolute'];
        
        // Normalize file arrays
        $names = is_array($files['name']) ? $files['name'] : [$files['name']];
        $tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
        $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
        $errors = is_array($files['error']) ? $files['error'] : [$files['error']];
        
        // Get relative paths for folder uploads
        $relativePaths = Request::post('relativePaths', []);
        if (!is_array($relativePaths)) {
            $relativePaths = [];
        }
        
        $results = [];
        $tempDir = Config::getTempDir();
        ensureDirectoryExists($tempDir);
        
        // Process each file
        foreach ($names as $idx => $originalName) {
            $result = $this->processFile(
                $originalName,
                $tmpNames[$idx] ?? '',
                (int)($sizes[$idx] ?? 0),
                $errors[$idx] ?? UPLOAD_ERR_NO_FILE,
                $relativePaths[$idx] ?? '',
                $targetDir,
                $tempDir
            );
            
            $results[] = $result;
        }
        
        return [
            'success' => true,
            'message' => 'Upload processed.',
            'results' => $results,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Process a single file upload
     * 
     * @param string $originalName Original filename
     * @param string $tmpName Temporary file path
     * @param int $size File size in bytes
     * @param int $error PHP upload error code
     * @param string $relativePath Relative path for folder uploads
     * @param string $targetDir Target directory absolute path
     * @param string $tempDir Temporary directory for staging
     * @return array Result for this file
     */
    private function processFile(
        string $originalName,
        string $tmpName,
        int $size,
        int $error,
        string $relativePath,
        string $targetDir,
        string $tempDir
    ): array {
        $result = [
            'filename' => $originalName,
            'success' => false,
            'message' => ''
        ];
        
        // Handle PHP upload errors
        if ($error !== UPLOAD_ERR_OK) {
            $result['message'] = getUploadErrorMessage($error);
            return $result;
        }
        
        // Sanitize the path
        $sanitizedPath = $this->sanitizePath($relativePath, $originalName);
        if ($sanitizedPath === '') {
            $result['message'] = 'Invalid filename or path.';
            return $result;
        }
        
        $finalPath = $targetDir . DIRECTORY_SEPARATOR . $sanitizedPath;
        
        // Create nested directories if needed
        $finalDir = dirname($finalPath);
        if ($finalDir !== $targetDir && !is_dir($finalDir)) {
            if (!ensureDirectoryExists($finalDir)) {
                $result['message'] = 'Failed to create directory structure.';
                return $result;
            }
            
            // Verify created directory is within root
            $finalDirReal = realpath($finalDir);
            $storageRoot = realpath(Config::get('STORAGE_ROOT'));
            if ($finalDirReal === false || !PathValidator::isWithinRoot($storageRoot, $finalDirReal)) {
                $result['message'] = 'Invalid directory path.';
                return $result;
            }
        }
        
        // Check for duplicates
        if (file_exists($finalPath)) {
            $result['message'] = 'A file with the same name already exists.';
            return $result;
        }
        
        // Check disk space
        if (!$this->storageService->hasEnoughSpace($size)) {
            $result['message'] = 'Insufficient disk space on server.';
            return $result;
        }
        
        // Validate uploaded file
        if (!is_uploaded_file($tmpName)) {
            $result['message'] = 'Invalid uploaded file.';
            return $result;
        }
        
        // Transactional move: stage in temp, then atomic rename
        $tmpPartName = basename($sanitizedPath);
        $tmpPart = $tempDir . DIRECTORY_SEPARATOR . uniqid('up_', true) . '_' . $tmpPartName . '.part';
        $this->inflightFiles[] = $tmpPart;
        
        // Move to temp staging area
        if (!@move_uploaded_file($tmpName, $tmpPart)) {
            $result['message'] = 'Failed to move uploaded file.';
            $this->removeInflight($tmpPart);
            return $result;
        }
        
        // Check if client aborted
        if (Request::isAborted()) {
            @unlink($tmpPart);
            $this->removeInflight($tmpPart);
            $result['message'] = 'Upload aborted by client; rolled back.';
            return $result;
        }
        
        // Finalize: atomic rename
        if (!@rename($tmpPart, $finalPath)) {
            @unlink($tmpPart);
            $this->removeInflight($tmpPart);
            $result['message'] = 'Failed to finalize uploaded file.';
            return $result;
        }
        
        $this->removeInflight($tmpPart);
        
        // Apply permissions
        applyPermissions($finalPath, false);
        
        $result['success'] = true;
        $result['filename'] = $sanitizedPath;
        $result['message'] = 'File uploaded successfully.';
        
        return $result;
    }
    
    /**
     * Sanitize upload path (handles folder uploads)
     * 
     * @param string $relativePath Relative path from folder upload
     * @param string $filename Original filename
     * @return string Sanitized path
     */
    private function sanitizePath(string $relativePath, string $filename): string
    {
        if ($relativePath !== '') {
            return Sanitizer::sanitizeRelativePath($relativePath);
        }
        
        return Sanitizer::sanitizeFilename($filename);
    }
    
    /**
     * Remove a file from inflight tracking
     * 
     * @param string $path File path to remove
     */
    private function removeInflight(string $path): void
    {
        $this->inflightFiles = array_filter(
            $this->inflightFiles,
            fn($p) => $p !== $path
        );
    }
    
    /**
     * Cleanup inflight temporary files on shutdown
     */
    public function cleanup(): void
    {
        foreach ($this->inflightFiles as $file) {
            if (file_exists($file)) {
                @unlink($file);
            }
        }
    }
    
    /**
     * Check upload status for resumability
     * 
     * @param string $uploadId Unique identifier for this upload session
     * @return array Status information
     */
    public function checkUploadStatus(string $uploadId): array
    {
        // Validate uploadId (alphanumeric and hyphens only)
        if (!preg_match('/^[a-zA-Z0-9\-]+$/', $uploadId)) {
            return [
                'success' => false,
                'message' => 'Invalid upload ID.'
            ];
        }
        
        // Check if chunks directory exists
        $chunksBaseDir = Config::get('CHUNK_TEMP_DIR') . DIRECTORY_SEPARATOR . 'chunks';
        $uploadDir = $chunksBaseDir . DIRECTORY_SEPARATOR . $uploadId;
        
        if (!is_dir($uploadDir)) {
            return [
                'success' => true,
                'exists' => false,
                'nextChunkIndex' => 0,
                'message' => 'No existing upload found.'
            ];
        }
        
        // Count existing chunks (sequential from 0)
        $nextChunkIndex = 0;
        while (true) {
            $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . $nextChunkIndex . '.part';
            if (!file_exists($chunkPath)) {
                break;
            }
            $nextChunkIndex++;
        }
        
        return [
            'success' => true,
            'exists' => true,
            'nextChunkIndex' => $nextChunkIndex,
            'message' => "Found $nextChunkIndex existing chunks."
        ];
    }
    
    /**
     * Handle chunked file upload
     * 
     * @param string $uploadId Unique identifier for this upload session
     * @param int $chunkIndex Current chunk index (0-based)
     * @param int $totalChunks Total number of chunks
     * @param string $filename Original filename
     * @param string $relativePath Relative path for folder uploads
     * @param string $targetPath Target directory path
     * @return array Response with status
     */
    public function handleChunk(
        string $uploadId,
        int $chunkIndex,
        int $totalChunks,
        string $filename,
        string $relativePath,
        string $targetPath
    ): array {
        // Check if operation is allowed
        $check = checkOperationAllowed('upload');
        if (!$check['allowed']) {
            return [
                'success' => false,
                'message' => $check['message']
            ];
        }
        
        // Allow script to continue for cleanup even if client disconnects
        ignore_user_abort(true);
        
        // Validate uploadId (alphanumeric and hyphens only)
        if (!preg_match('/^[a-zA-Z0-9\-]+$/', $uploadId)) {
            return [
                'success' => false,
                'message' => 'Invalid upload ID.'
            ];
        }
        
        // Validate chunk parameters
        if ($chunkIndex < 0 || $chunkIndex >= $totalChunks || $totalChunks <= 0) {
            return [
                'success' => false,
                'message' => 'Invalid chunk parameters.'
            ];
        }
        
        // Validate target path
        $validated = PathValidator::validatePath($targetPath);
        if ($validated === null) {
            return [
                'success' => false,
                'message' => 'Target path not found.'
            ];
        }
        
        $targetDir = $validated['absolute'];
        
        // Create chunks directory
        $chunksBaseDir = Config::get('CHUNK_TEMP_DIR') . DIRECTORY_SEPARATOR . 'chunks';
        ensureDirectoryExists($chunksBaseDir);
        
        // Clean up stale chunks on first chunk (index 0)
        if ($chunkIndex === 0) {
            $this->cleanupStaleChunks($chunksBaseDir);
        }
        
        // Create upload-specific directory
        $uploadDir = $chunksBaseDir . DIRECTORY_SEPARATOR . $uploadId;
        ensureDirectoryExists($uploadDir);
        
        // Get chunk data from $_FILES
        $chunkFile = Request::files('chunk');
        if ($chunkFile === null || !isset($chunkFile['tmp_name'])) {
            return [
                'success' => false,
                'message' => 'No chunk data provided.'
            ];
        }
        
        $tmpName = $chunkFile['tmp_name'];
        $error = $chunkFile['error'] ?? UPLOAD_ERR_NO_FILE;
        
        // Handle PHP upload errors
        if ($error !== UPLOAD_ERR_OK) {
            return [
                'success' => false,
                'message' => getUploadErrorMessage($error)
            ];
        }
        
        // Validate uploaded file
        if (!is_uploaded_file($tmpName)) {
            return [
                'success' => false,
                'message' => 'Invalid uploaded chunk.'
            ];
        }
        
        // Save chunk
        $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . $chunkIndex . '.part';
        if (!@move_uploaded_file($tmpName, $chunkPath)) {
            return [
                'success' => false,
                'message' => 'Failed to save chunk.'
            ];
        }
        
        // Check if client aborted
        if (Request::isAborted()) {
            $this->cleanupUploadDirectory($uploadDir);
            return [
                'success' => false,
                'message' => 'Upload aborted by client.'
            ];
        }
        
        // Check if this is the last chunk
        if ($chunkIndex + 1 === $totalChunks) {
            // Merge chunks into final file
            return $this->mergeChunks(
                $uploadDir,
                $totalChunks,
                $filename,
                $relativePath,
                $targetDir
            );
        }
        
        // Not the last chunk, return success
        return [
            'success' => true,
            'message' => 'Chunk received.',
            'chunkIndex' => $chunkIndex,
            'totalChunks' => $totalChunks
        ];
    }
    
    /**
     * Merge all chunks into final file
     * 
     * @param string $uploadDir Directory containing chunks
     * @param int $totalChunks Total number of chunks
     * @param string $filename Original filename
     * @param string $relativePath Relative path for folder uploads
     * @param string $targetDir Target directory absolute path
     * @return array Result of merge operation
     */
    private function mergeChunks(
        string $uploadDir,
        int $totalChunks,
        string $filename,
        string $relativePath,
        string $targetDir
    ): array {
        // Verify all chunks exist
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . $i . '.part';
            if (!file_exists($chunkPath)) {
                $this->cleanupUploadDirectory($uploadDir);
                return [
                    'success' => false,
                    'message' => "Missing chunk $i of $totalChunks."
                ];
            }
        }
        
        // Sanitize the path
        $sanitizedPath = $this->sanitizePath($relativePath, $filename);
        if ($sanitizedPath === '') {
            $this->cleanupUploadDirectory($uploadDir);
            return [
                'success' => false,
                'message' => 'Invalid filename or path.'
            ];
        }
        
        $finalPath = $targetDir . DIRECTORY_SEPARATOR . $sanitizedPath;
        
        // Create nested directories if needed
        $finalDir = dirname($finalPath);
        if ($finalDir !== $targetDir && !is_dir($finalDir)) {
            if (!ensureDirectoryExists($finalDir)) {
                $this->cleanupUploadDirectory($uploadDir);
                return [
                    'success' => false,
                    'message' => 'Failed to create directory structure.'
                ];
            }
            
            // Verify created directory is within root
            $finalDirReal = realpath($finalDir);
            $storageRoot = realpath(Config::get('STORAGE_ROOT'));
            if ($finalDirReal === false || !PathValidator::isWithinRoot($storageRoot, $finalDirReal)) {
                $this->cleanupUploadDirectory($uploadDir);
                return [
                    'success' => false,
                    'message' => 'Invalid directory path.'
                ];
            }
        }
        
        // Check for duplicates
        if (file_exists($finalPath)) {
            $this->cleanupUploadDirectory($uploadDir);
            return [
                'success' => false,
                'message' => 'A file with the same name already exists.'
            ];
        }
        
        // Calculate total size and check disk space
        $totalSize = 0;
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . $i . '.part';
            $totalSize += filesize($chunkPath);
        }
        
        if (!$this->storageService->hasEnoughSpace($totalSize)) {
            $this->cleanupUploadDirectory($uploadDir);
            return [
                'success' => false,
                'message' => 'Insufficient disk space on server.'
            ];
        }
        
        // Open final file for writing
        $finalHandle = @fopen($finalPath, 'wb');
        if ($finalHandle === false) {
            $this->cleanupUploadDirectory($uploadDir);
            return [
                'success' => false,
                'message' => 'Failed to create final file.'
            ];
        }
        
        // Merge chunks sequentially
        for ($i = 0; $i < $totalChunks; $i++) {
            $chunkPath = $uploadDir . DIRECTORY_SEPARATOR . $i . '.part';
            $chunkHandle = @fopen($chunkPath, 'rb');
            
            if ($chunkHandle === false) {
                fclose($finalHandle);
                @unlink($finalPath);
                $this->cleanupUploadDirectory($uploadDir);
                return [
                    'success' => false,
                    'message' => "Failed to read chunk $i."
                ];
            }
            
            // Stream chunk to final file
            while (!feof($chunkHandle)) {
                $buffer = fread($chunkHandle, 8192);
                if ($buffer === false) {
                    fclose($chunkHandle);
                    fclose($finalHandle);
                    @unlink($finalPath);
                    $this->cleanupUploadDirectory($uploadDir);
                    return [
                        'success' => false,
                        'message' => "Failed to read chunk $i."
                    ];
                }
                
                if (fwrite($finalHandle, $buffer) === false) {
                    fclose($chunkHandle);
                    fclose($finalHandle);
                    @unlink($finalPath);
                    $this->cleanupUploadDirectory($uploadDir);
                    return [
                        'success' => false,
                        'message' => 'Failed to write to final file.'
                    ];
                }
            }
            
            fclose($chunkHandle);
            
            // Check if client aborted during merge
            if (Request::isAborted()) {
                fclose($finalHandle);
                @unlink($finalPath);
                $this->cleanupUploadDirectory($uploadDir);
                return [
                    'success' => false,
                    'message' => 'Upload aborted during merge.'
                ];
            }
        }
        
        fclose($finalHandle);
        
        // Verify final file size
        $finalSize = filesize($finalPath);
        if ($finalSize !== $totalSize) {
            @unlink($finalPath);
            $this->cleanupUploadDirectory($uploadDir);
            return [
                'success' => false,
                'message' => 'File size mismatch after merge.'
            ];
        }
        
        // Apply permissions
        applyPermissions($finalPath, false);
        
        // Cleanup chunks
        $this->cleanupUploadDirectory($uploadDir);
        
        return [
            'success' => true,
            'message' => 'File uploaded successfully.',
            'filename' => $sanitizedPath,
            'size' => $totalSize,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Clean up stale chunk directories
     * 
     * @param string $chunksBaseDir Base chunks directory
     */
    private function cleanupStaleChunks(string $chunksBaseDir): void
    {
        if (!is_dir($chunksBaseDir)) {
            return;
        }
        
        $staleHours = Config::get('CHUNK_STALE_HOURS');
        $staleThreshold = time() - ($staleHours * 3600);
        $items = @scandir($chunksBaseDir);
        
        if ($items === false) {
            return;
        }
        
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            
            $itemPath = $chunksBaseDir . DIRECTORY_SEPARATOR . $item;
            
            if (is_dir($itemPath)) {
                $mtime = @filemtime($itemPath);
                if ($mtime !== false && $mtime < $staleThreshold) {
                    $this->cleanupUploadDirectory($itemPath);
                }
            }
        }
    }
    
    /**
     * Recursively delete upload directory and its contents
     * 
     * @param string $uploadDir Directory to delete
     */
    private function cleanupUploadDirectory(string $uploadDir): void
    {
        if (!is_dir($uploadDir)) {
            return;
        }
        
        $items = @scandir($uploadDir);
        if ($items === false) {
            return;
        }
        
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            
            $itemPath = $uploadDir . DIRECTORY_SEPARATOR . $item;
            
            if (is_file($itemPath)) {
                @unlink($itemPath);
            }
        }
        
        @rmdir($uploadDir);
    }
}
