<?php
/**
 * Upload Service
 * 
 * Handles file uploads with transactional support, including:
 * - Multi-file uploads
 * - Folder structure preservation
 * - Size validation
 * - Session limits
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
        
        // Initialize session upload tracking
        if (!isset($_SESSION['uploaded_total_bytes'])) {
            $_SESSION['uploaded_total_bytes'] = 0;
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
            'session_total_bytes' => $_SESSION['uploaded_total_bytes'],
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
        
        // Server-side size check
        if ($size > Config::get('MAX_FILE_BYTES')) {
            $result['message'] = 'File exceeds maximum allowed size.';
            return $result;
        }
        
        // Check per-session cumulative limit
        $sessionTotal = $_SESSION['uploaded_total_bytes'];
        if ($sessionTotal + $size > Config::get('MAX_SESSION_BYTES')) {
            $result['message'] = 'Per-session upload limit exceeded.';
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
        
        // Update session total
        $_SESSION['uploaded_total_bytes'] += $size;
        
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
}
