<?php
/**
 * Path Validator
 * 
 * Provides path traversal protection and validation to ensure
 * all file operations stay within the storage root directory.
 */

declare(strict_types=1);

namespace NanoCloud\Security;

use NanoCloud\Core\Config;

class PathValidator
{
    /**
     * Validate and resolve a relative path within storage root
     * 
     * @param string $relativePath Relative path to validate
     * @return array|null Array with 'absolute' and 'relative' paths, or null if invalid
     */
    public static function validatePath(string $relativePath): ?array
    {
        $storageRoot = Config::get('STORAGE_ROOT');
        $storageRootReal = realpath($storageRoot);
        
        if ($storageRootReal === false) {
            return null;
        }
        
        // Normalize the relative path
        $normalized = self::normalizePath($relativePath);
        
        // Empty path means root directory
        if ($normalized === '') {
            return [
                'absolute' => $storageRootReal,
                'relative' => ''
            ];
        }
        
        // Build absolute path
        $absolutePath = $storageRoot . DIRECTORY_SEPARATOR . 
                       str_replace('/', DIRECTORY_SEPARATOR, $normalized);
        
        // Resolve to real path
        $realPath = realpath($absolutePath);
        
        // If path doesn't exist yet, check parent directory
        if ($realPath === false) {
            $parentDir = dirname($absolutePath);
            $realPath = realpath($parentDir);
            
            if ($realPath === false) {
                return null;
            }
            
            // Reconstruct the full path with the basename
            $realPath = $realPath . DIRECTORY_SEPARATOR . basename($absolutePath);
        }
        
        // Verify path is within storage root
        if (!self::isWithinRoot($storageRootReal, $realPath)) {
            return null;
        }
        
        return [
            'absolute' => $realPath,
            'relative' => $normalized
        ];
    }
    
    /**
     * Check if a path is within the storage root
     * 
     * @param string $root Storage root real path
     * @param string $path Path to check
     * @return bool True if path is within root
     */
    public static function isWithinRoot(string $root, string $path): bool
    {
        $root = rtrim(strtolower(str_replace('\\', '/', $root)), '/');
        $path = strtolower(str_replace('\\', '/', $path));
        
        return str_starts_with($path, $root . '/') || $path === $root;
    }
    
    /**
     * Normalize a relative path
     * 
     * Converts backslashes to forward slashes, sanitizes each segment,
     * and removes empty segments.
     * 
     * @param string $path Path to normalize
     * @return string Normalized path
     */
    public static function normalizePath(string $path): string
    {
        if (empty($path)) {
            return '';
        }
        
        // Convert backslashes to forward slashes
        $path = str_replace('\\', '/', $path);
        
        // Split into segments
        $segments = explode('/', $path);
        
        // Sanitize and filter segments
        $clean = [];
        foreach ($segments as $segment) {
            $sanitized = Sanitizer::sanitizeSegment($segment);
            if ($sanitized !== '') {
                $clean[] = $sanitized;
            }
        }
        
        return implode('/', $clean);
    }
    
    /**
     * Build breadcrumbs array from a relative path
     * 
     * @param string $relativePath Relative path
     * @return array Array of path segments
     */
    public static function buildBreadcrumbs(string $relativePath): array
    {
        if ($relativePath === '') {
            return [];
        }
        
        return explode('/', $relativePath);
    }
    
    /**
     * Get parent path from a relative path
     * 
     * @param string $relativePath Relative path
     * @return string Parent path
     */
    public static function getParentPath(string $relativePath): string
    {
        if ($relativePath === '') {
            return '';
        }
        
        $segments = explode('/', $relativePath);
        array_pop($segments);
        
        return implode('/', $segments);
    }
}
