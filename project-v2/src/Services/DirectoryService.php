<?php
/**
 * Directory Service
 * 
 * Handles directory operations including listing, creation, deletion,
 * and renaming of directories.
 */

declare(strict_types=1);

namespace NanoCloud\Services;

use NanoCloud\Security\PathValidator;
use NanoCloud\Security\Sanitizer;
use NanoCloud\Core\Config;
use function NanoCloud\Helpers\applyPermissions;
use function NanoCloud\Helpers\recursiveDelete;
use function NanoCloud\Helpers\checkOperationAllowed;

class DirectoryService
{
    private StorageService $storageService;
    
    public function __construct()
    {
        $this->storageService = new StorageService();
    }
    
    /**
     * List contents of a directory
     * 
     * @param string $relativePath Relative path to list
     * @return array Response with items, breadcrumbs, and storage info
     */
    public function listDirectory(string $relativePath): array
    {
        $validated = PathValidator::validatePath($relativePath);
        
        if ($validated === null) {
            return [
                'success' => false,
                'message' => 'Path not found.',
                'items' => [],
                'path' => $relativePath,
                'breadcrumbs' => PathValidator::buildBreadcrumbs($relativePath),
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $absolutePath = $validated['absolute'];
        $items = [];
        
        $scan = @scandir($absolutePath);
        if ($scan === false) {
            return [
                'success' => false,
                'message' => 'Unable to open directory.',
                'items' => [],
                'path' => $validated['relative'],
                'breadcrumbs' => PathValidator::buildBreadcrumbs($validated['relative']),
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $dirs = [];
        $files = [];
        
        foreach ($scan as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            
            // Hide hidden files/directories (dot-prefixed)
            if (strlen($entry) > 0 && $entry[0] === '.') {
                continue;
            }
            
            $itemPath = $absolutePath . DIRECTORY_SEPARATOR . $entry;
            
            if (is_dir($itemPath)) {
                // Count non-hidden items in directory
                $count = 0;
                $sub = @scandir($itemPath);
                if (is_array($sub)) {
                    foreach ($sub as $e) {
                        if ($e === '.' || $e === '..') {
                            continue;
                        }
                        if (strlen($e) > 0 && $e[0] === '.') {
                            continue;
                        }
                        $count++;
                    }
                }
                
                $dirs[] = [
                    'name' => $entry,
                    'type' => 'dir',
                    'mtime' => @filemtime($itemPath) ?: null,
                    'count' => $count
                ];
            } elseif (is_file($itemPath)) {
                $files[] = [
                    'name' => $entry,
                    'type' => 'file',
                    'size' => @filesize($itemPath) ?: null,
                    'mtime' => @filemtime($itemPath) ?: null
                ];
            }
        }
        
        // Combine directories first, then files (frontend handles sorting)
        $items = array_merge($dirs, $files);
        
        return [
            'success' => true,
            'message' => 'OK',
            'items' => $items,
            'path' => $validated['relative'],
            'breadcrumbs' => PathValidator::buildBreadcrumbs($validated['relative']),
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Create a new directory
     * 
     * @param string $relativePath Parent directory path
     * @param string $name Directory name
     * @return array Response with success status
     */
    public function createDirectory(string $relativePath, string $name): array
    {
        // Check if operation is allowed
        $check = checkOperationAllowed('upload');
        if (!$check['allowed']) {
            return [
                'success' => false,
                'message' => $check['message'],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $validated = PathValidator::validatePath($relativePath);
        if ($validated === null) {
            return [
                'success' => false,
                'message' => 'Target path not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $sanitized = Sanitizer::sanitizeSegment($name);
        if ($sanitized === '') {
            return [
                'success' => false,
                'message' => 'Invalid directory name.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $newDirPath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitized;
        
        if (file_exists($newDirPath)) {
            return [
                'success' => false,
                'message' => 'Directory already exists.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (!@mkdir($newDirPath, Config::get('DIR_PERMISSIONS'), false)) {
            return [
                'success' => false,
                'message' => 'Failed to create directory.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        applyPermissions($newDirPath, true);
        
        return [
            'success' => true,
            'message' => 'Directory created.',
            'name' => $sanitized,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Delete a directory recursively
     * 
     * @param string $relativePath Parent directory path
     * @param string $name Directory name to delete
     * @return array Response with success status
     */
    public function deleteDirectory(string $relativePath, string $name): array
    {
        // Check if operation is allowed
        $check = checkOperationAllowed('delete');
        if (!$check['allowed']) {
            return [
                'success' => false,
                'message' => $check['message'],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $validated = PathValidator::validatePath($relativePath);
        if ($validated === null) {
            return [
                'success' => false,
                'message' => 'Target path not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $sanitized = Sanitizer::sanitizeSegment($name);
        if ($sanitized === '') {
            return [
                'success' => false,
                'message' => 'Invalid directory name.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $targetPath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitized;
        $targetReal = realpath($targetPath);
        
        if ($targetReal === false || !is_dir($targetReal)) {
            return [
                'success' => false,
                'message' => 'Directory not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Verify within storage root
        $storageRoot = realpath(Config::get('STORAGE_ROOT'));
        if (!PathValidator::isWithinRoot($storageRoot, $targetReal)) {
            return [
                'success' => false,
                'message' => 'Invalid directory path.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Prevent deleting storage root
        if ($targetReal === $storageRoot) {
            return [
                'success' => false,
                'message' => 'Cannot delete root directory.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (!recursiveDelete($targetReal)) {
            return [
                'success' => false,
                'message' => 'Failed to delete directory.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        return [
            'success' => true,
            'message' => 'Directory deleted.',
            'name' => $sanitized,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Rename a directory
     * 
     * @param string $relativePath Parent directory path
     * @param string $oldName Current directory name
     * @param string $newName New directory name
     * @return array Response with success status
     */
    public function renameDirectory(string $relativePath, string $oldName, string $newName): array
    {
        // Check if operation is allowed
        $check = checkOperationAllowed('rename');
        if (!$check['allowed']) {
            return [
                'success' => false,
                'message' => $check['message'],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $validated = PathValidator::validatePath($relativePath);
        if ($validated === null) {
            return [
                'success' => false,
                'message' => 'Target path not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $sanitizedOld = Sanitizer::sanitizeSegment($oldName);
        $sanitizedNew = Sanitizer::sanitizeSegment($newName);
        
        if ($sanitizedOld === '' || $sanitizedNew === '') {
            return [
                'success' => false,
                'message' => 'Invalid directory name.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $oldPath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedOld;
        $newPath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedNew;
        
        $oldPathReal = realpath($oldPath);
        if ($oldPathReal === false || !is_dir($oldPathReal)) {
            return [
                'success' => false,
                'message' => 'Directory not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Verify within storage root
        $storageRoot = realpath(Config::get('STORAGE_ROOT'));
        if (!PathValidator::isWithinRoot($storageRoot, $oldPathReal)) {
            return [
                'success' => false,
                'message' => 'Invalid directory path.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Prevent renaming storage root
        if ($oldPathReal === $storageRoot) {
            return [
                'success' => false,
                'message' => 'Cannot rename root directory.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (file_exists($newPath)) {
            return [
                'success' => false,
                'message' => 'A directory with the new name already exists.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (!@rename($oldPath, $newPath)) {
            return [
                'success' => false,
                'message' => 'Failed to rename directory.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        return [
            'success' => true,
            'message' => 'Directory renamed.',
            'name' => $sanitizedOld,
            'newName' => $sanitizedNew,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
}
