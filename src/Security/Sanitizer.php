<?php
/**
 * Input Sanitizer
 * 
 * Provides methods to sanitize user input, particularly filenames
 * and path segments, to prevent security issues.
 */

declare(strict_types=1);

namespace NanoCloud\Security;

class Sanitizer
{
    /**
     * Sanitize a filename (single file name, not a path)
     * 
     * Removes or replaces dangerous characters while preserving
     * common safe characters like parentheses, brackets, and plus signs.
     * 
     * @param string $filename Filename to sanitize
     * @return string Sanitized filename
     */
    public static function sanitizeFilename(string $filename): string
    {
        // Get basename to remove any path components
        $filename = basename($filename);
        
        // Allow: letters, numbers, dots, spaces, hyphens, underscores,
        // parentheses, square brackets, and plus signs
        $filename = preg_replace('/[^A-Za-z0-9._ \-\(\)\[\]\+]/', '_', $filename);
        
        // Trim whitespace
        $filename = trim($filename);
        
        // Reject dangerous names
        if ($filename === '' || $filename === '.' || $filename === '..') {
            $filename = 'file_' . time();
        }
        
        return $filename;
    }
    
    /**
     * Sanitize a path segment (folder or file name without slashes)
     * 
     * Similar to sanitizeFilename but rejects segments that are
     * empty, '.', or '..' after sanitization.
     * 
     * @param string $segment Path segment to sanitize
     * @return string Sanitized segment (empty string if invalid)
     */
    public static function sanitizeSegment(string $segment): string
    {
        // Remove any slashes
        $segment = str_replace(['\\', '/'], '_', $segment);
        
        // Allow same characters as filename
        $segment = preg_replace('/[^A-Za-z0-9._ \-\(\)\[\]\+]/', '_', $segment);
        
        // Trim whitespace
        $segment = trim($segment);
        
        // Reject dangerous or empty segments
        if ($segment === '' || $segment === '.' || $segment === '..') {
            return '';
        }
        
        return $segment;
    }
    
    /**
     * Sanitize a relative path for folder uploads
     * 
     * Takes a relative path (e.g., "folder/subfolder/file.txt") and
     * sanitizes each segment, returning the clean path.
     * 
     * @param string $relativePath Relative path to sanitize
     * @return string Sanitized relative path
     */
    public static function sanitizeRelativePath(string $relativePath): string
    {
        if (empty($relativePath)) {
            return '';
        }
        
        // Split path into segments
        $segments = explode('/', str_replace('\\', '/', $relativePath));
        
        // Sanitize each segment
        $sanitized = [];
        foreach ($segments as $i => $segment) {
            if ($segment === '') {
                continue;
            }
            
            // Last segment is the filename, others are folder names
            $isLastSegment = ($i === count($segments) - 1);
            
            if ($isLastSegment) {
                $clean = self::sanitizeFilename($segment);
            } else {
                $clean = self::sanitizeSegment($segment);
            }
            
            if ($clean !== '') {
                $sanitized[] = $clean;
            }
        }
        
        return implode('/', $sanitized);
    }
}
