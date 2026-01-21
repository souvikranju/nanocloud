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
$mimeType = mime_content_type($filePath);

// Fallback MIME type
if ($mimeType === false) {
    $mimeType = 'application/octet-stream';
}

// Set headers
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . $fileSize);
header('Content-Disposition: inline; filename="' . addslashes($sanitizedFilename) . '"');
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
