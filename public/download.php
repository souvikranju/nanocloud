<?php
/**
 * File Download Handler
 * 
 * Handles file downloads with proper MIME types, rate limiting,
 * and security checks.
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/autoload.php';
require_once dirname(__DIR__) . '/src/Helpers/functions.php';

use NanoCloud\Core\Config;
use NanoCloud\Security\PathValidator;
use NanoCloud\Security\Sanitizer;

// Load configuration
Config::load();

// Get requested file path
$relativePath = $_GET['path'] ?? '';
$filename = $_GET['file'] ?? '';

// Validate inputs
if ($filename === '') {
    http_response_code(400);
    die('Missing filename parameter.');
}

// Sanitize filename
$sanitizedFilename = Sanitizer::sanitizeSegment($filename);
if ($sanitizedFilename === '') {
    http_response_code(400);
    die('Invalid filename.');
}

// Validate and resolve path
$validated = PathValidator::validatePath($relativePath);
if ($validated === null) {
    http_response_code(404);
    die('Path not found.');
}

// Build full file path
$filePath = $validated['absolute'] . DIRECTORY_SEPARATOR . $sanitizedFilename;

// Verify file exists and is a file
if (!file_exists($filePath) || !is_file($filePath)) {
    http_response_code(404);
    die('File not found.');
}

// Get file info
$fileSize = filesize($filePath);
$mimeType = getMimeTypeForFile($filePath, $sanitizedFilename);

// Determine Content-Disposition based on file type
$contentDisposition = shouldStreamInBrowser($sanitizedFilename) ? 'inline' : 'attachment';

// Set headers
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $fileSize);
header('Content-Disposition: ' . $contentDisposition . '; filename="' . addslashes($sanitizedFilename) . '"');
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=3600');

// Handle range requests for streaming
$rangeHeader = $_SERVER['HTTP_RANGE'] ?? '';
if ($rangeHeader !== '' && preg_match('/bytes=(\d+)-(\d*)/', $rangeHeader, $matches)) {
    $start = (int)$matches[1];
    $end = $matches[2] !== '' ? (int)$matches[2] : $fileSize - 1;
    
    // Validate range
    if ($start > $end || $start >= $fileSize) {
        http_response_code(416);
        header('Content-Range: bytes */' . $fileSize);
        die('Invalid range.');
    }
    
    $length = $end - $start + 1;
    
    http_response_code(206);
    header('Content-Range: bytes ' . $start . '-' . $end . '/' . $fileSize);
    header('Content-Length: ' . $length);
    
    // Open file and seek to start position
    $fp = fopen($filePath, 'rb');
    if ($fp === false) {
        http_response_code(500);
        die('Failed to open file.');
    }
    
    fseek($fp, $start);
    
    // Stream with rate limiting if configured
    $rateLimit = Config::get('DOWNLOAD_RATE_LIMIT_MB', 0);
    if ($rateLimit > 0) {
        streamFileWithRateLimit($fp, $length, $rateLimit);
    } else {
        streamFile($fp, $length);
    }
    
    fclose($fp);
} else {
    // Full file download
    $fp = fopen($filePath, 'rb');
    if ($fp === false) {
        http_response_code(500);
        die('Failed to open file.');
    }
    
    // Stream with rate limiting if configured
    $rateLimit = Config::get('DOWNLOAD_RATE_LIMIT_MB', 0);
    if ($rateLimit > 0) {
        streamFileWithRateLimit($fp, $fileSize, $rateLimit);
    } else {
        streamFile($fp, $fileSize);
    }
    
    fclose($fp);
}

/**
 * Determine if file should be streamed inline in browser
 * 
 * @param string $filename Filename with extension
 * @return bool True if file should be streamed inline, false to force download
 */
function shouldStreamInBrowser(string $filename): bool
{
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    
    // Files that should NEVER be opened in browser (force download)
    $forceDownloadExts = ['avi', 'wmv', 'flv', 'exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm'];
    if (in_array($ext, $forceDownloadExts, true)) {
        return false;
    }
    
    // Images - viewable in browser
    $imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    if (in_array($ext, $imageExts, true)) {
        return true;
    }
    
    // Videos - only browser-supported formats
    $videoExts = ['mp4', 'webm', 'ogg', 'mov', 'm4v', '3gp', 'mkv'];
    if (in_array($ext, $videoExts, true)) {
        return true;
    }
    
    // Audio - browser-supported formats
    $audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    if (in_array($ext, $audioExts, true)) {
        return true;
    }
    
    // Text files - viewable in browser
    $textExts = ['txt', 'json', 'xml', 'html', 'css', 'js', 'md'];
    if (in_array($ext, $textExts, true)) {
        return true;
    }
    
    // PDFs - can be viewed inline in browser
    if ($ext === 'pdf') {
        return true;
    }
    
    // Default: force download for unknown types
    return false;
}

/**
 * Get MIME type for file with extension-based overrides
 * 
 * @param string $filePath Full file path
 * @param string $filename Filename with extension
 * @return string MIME type
 */
function getMimeTypeForFile(string $filePath, string $filename): string
{
    // Extension-based MIME type mapping for media files
    // This ensures browsers receive correct hints for streaming
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    
    $mimeMap = [
        // Video formats
        'mp4' => 'video/mp4',
        'm4v' => 'video/mp4',
        'mov' => 'video/quicktime',
        'mkv' => 'video/x-matroska',
        '3gp' => 'video/3gpp',
        'webm' => 'video/webm',
        'ogg' => 'video/ogg',
        'ogv' => 'video/ogg',
        'avi' => 'video/x-msvideo',
        'wmv' => 'video/x-ms-wmv',
        'flv' => 'video/x-flv',
        
        // Audio formats
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'flac' => 'audio/flac',
        'aac' => 'audio/aac',
        'm4a' => 'audio/mp4',
        'oga' => 'audio/ogg',
        'opus' => 'audio/opus',
        'wma' => 'audio/x-ms-wma',
        
        // Image formats
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'bmp' => 'image/bmp',
        'ico' => 'image/x-icon',
        
        // Document formats
        'pdf' => 'application/pdf',
        'txt' => 'text/plain',
        'html' => 'text/html',
        'htm' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'xml' => 'application/xml',
    ];
    
    // Check if we have a mapping for this extension
    if (isset($mimeMap[$ext])) {
        return $mimeMap[$ext];
    }
    
    // Try PHP's mime_content_type as fallback
    $detectedMime = mime_content_type($filePath);
    if ($detectedMime !== false) {
        return $detectedMime;
    }
    
    // Final fallback
    return 'application/octet-stream';
}

/**
 * Stream file without rate limiting
 * 
 * @param resource $fp File pointer
 * @param int $length Bytes to stream
 */
function streamFile($fp, int $length): void
{
    $chunkSize = 8192; // 8KB chunks
    $bytesRead = 0;
    
    while (!feof($fp) && $bytesRead < $length) {
        $toRead = min($chunkSize, $length - $bytesRead);
        $chunk = fread($fp, $toRead);
        
        if ($chunk === false) {
            break;
        }
        
        echo $chunk;
        $bytesRead += strlen($chunk);
        
        // Flush output buffer
        if (ob_get_level() > 0) {
            ob_flush();
        }
        flush();
    }
}

/**
 * Stream file with rate limiting
 * 
 * @param resource $fp File pointer
 * @param int $length Bytes to stream
 * @param int $rateLimitMB Rate limit in MB/s
 */
function streamFileWithRateLimit($fp, int $length, int $rateLimitMB): void
{
    $chunkSize = 8192; // 8KB chunks
    $bytesPerSecond = $rateLimitMB * 1024 * 1024;
    $bytesRead = 0;
    $startTime = microtime(true);
    
    while (!feof($fp) && $bytesRead < $length) {
        $toRead = min($chunkSize, $length - $bytesRead);
        $chunk = fread($fp, $toRead);
        
        if ($chunk === false) {
            break;
        }
        
        echo $chunk;
        $bytesRead += strlen($chunk);
        
        // Flush output buffer
        if (ob_get_level() > 0) {
            ob_flush();
        }
        flush();
        
        // Calculate sleep time for rate limiting
        $elapsed = microtime(true) - $startTime;
        $expectedTime = $bytesRead / $bytesPerSecond;
        $sleepTime = $expectedTime - $elapsed;
        
        if ($sleepTime > 0) {
            usleep((int)($sleepTime * 1000000));
        }
    }
}
