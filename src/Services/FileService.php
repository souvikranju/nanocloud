<?php
/**
 * File Service
 * 
 * Handles file operations including deletion, renaming, and moving files.
 */

declare(strict_types=1);

namespace NanoCloud\Services;

use NanoCloud\Security\PathValidator;
use NanoCloud\Security\Sanitizer;
use NanoCloud\Core\Config;
use function NanoCloud\Helpers\applyPermissions;
use function NanoCloud\Helpers\checkOperationAllowed;

class FileService
{
    private StorageService $storageService;
    
    public function __construct()
    {
        $this->storageService = new StorageService();
    }
    
    /**
     * Delete a file
     * 
     * @param string $relativePath Parent directory path
     * @param string $filename File name to delete
     * @return array Response with success status
     */
    public function deleteFile(string $relativePath, string $filename): array
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
        
        $sanitized = Sanitizer::sanitizeSegment($filename);
        if ($sanitized === '') {
            return [
                'success' => false,
                'message' => 'Invalid filename.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $filePath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitized;
        
        if (!is_file($filePath)) {
            return [
                'success' => false,
                'message' => 'File not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (!@unlink($filePath)) {
            return [
                'success' => false,
                'message' => 'Failed to delete file.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        return [
            'success' => true,
            'message' => 'File deleted.',
            'filename' => $sanitized,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Rename a file
     * 
     * @param string $relativePath Parent directory path
     * @param string $oldName Current file name
     * @param string $newName New file name
     * @return array Response with success status
     */
    public function renameFile(string $relativePath, string $oldName, string $newName): array
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
        $sanitizedNew = Sanitizer::sanitizeFilename($newName);
        
        if ($sanitizedOld === '' || $sanitizedNew === '') {
            return [
                'success' => false,
                'message' => 'Invalid filename.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $oldPath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedOld;
        $newPath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedNew;
        
        if (!is_file($oldPath)) {
            return [
                'success' => false,
                'message' => 'File not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (file_exists($newPath)) {
            return [
                'success' => false,
                'message' => 'A file with the new name already exists.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (!@rename($oldPath, $newPath)) {
            return [
                'success' => false,
                'message' => 'Failed to rename file.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        return [
            'success' => true,
            'message' => 'File renamed.',
            'filename' => $sanitizedOld,
            'newName' => $sanitizedNew,
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
    
    /**
     * Move a file or directory to a different location
     * 
     * @param string $sourcePath Source directory path
     * @param string $itemType Item type ('file' or 'dir')
     * @param string $itemName Item name to move
     * @param string $targetPath Target directory path
     * @return array Response with success status
     */
    public function moveItem(string $sourcePath, string $itemType, string $itemName, string $targetPath): array
    {
        // Check if operation is allowed
        $check = checkOperationAllowed('move');
        if (!$check['allowed']) {
            return [
                'success' => false,
                'message' => $check['message'],
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Validate item type
        if (!in_array($itemType, ['file', 'dir'])) {
            return [
                'success' => false,
                'message' => 'Invalid item type. Must be "file" or "dir".',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Validate source path
        $sourceValidated = PathValidator::validatePath($sourcePath);
        if ($sourceValidated === null) {
            return [
                'success' => false,
                'message' => 'Source path not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Validate target path
        $targetValidated = PathValidator::validatePath($targetPath);
        if ($targetValidated === null) {
            return [
                'success' => false,
                'message' => 'Target path not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $sanitizedName = Sanitizer::sanitizeSegment($itemName);
        if ($sanitizedName === '') {
            return [
                'success' => false,
                'message' => 'Invalid item name.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        $sourceItemPath = $sourceValidated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedName;
        $targetItemPath = $targetValidated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedName;
        
        // Check if source exists
        if ($itemType === 'file' && !is_file($sourceItemPath)) {
            return [
                'success' => false,
                'message' => 'File not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if ($itemType === 'dir' && !is_dir($sourceItemPath)) {
            return [
                'success' => false,
                'message' => 'Directory not found.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Prevent moving storage root
        if ($itemType === 'dir') {
            $sourceReal = realpath($sourceItemPath);
            $storageRoot = realpath(Config::get('STORAGE_ROOT'));
            if ($sourceReal === $storageRoot) {
                return [
                    'success' => false,
                    'message' => 'Cannot move root directory.',
                    'storage' => $this->storageService->getStorageInfo()
                ];
            }
        }
        
        // Check if target already exists
        if (file_exists($targetItemPath)) {
            return [
                'success' => false,
                'message' => 'An item with the same name already exists in the target directory.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        if (!@rename($sourceItemPath, $targetItemPath)) {
            return [
                'success' => false,
                'message' => 'Failed to move item.',
                'storage' => $this->storageService->getStorageInfo()
            ];
        }
        
        // Apply permissions to moved files (directories maintain their permissions)
        if ($itemType === 'file') {
            applyPermissions($targetItemPath, false);
        }
        
        return [
            'success' => true,
            'message' => 'Item moved successfully.',
            'itemType' => $itemType,
            'itemName' => $sanitizedName,
            'fromPath' => $sourceValidated['relative'],
            'toPath' => $targetValidated['relative'],
            'storage' => $this->storageService->getStorageInfo()
        ];
    }
}
