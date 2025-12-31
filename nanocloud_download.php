<?php
 // nanocloud_download.php
// Serves files for download from the uploads directory, supporting nested directories securely.
// Security:
// - Only serves files from the configured uploads directory.
// - Sanitizes path segments and filename (no directory traversal).
// - Verifies resolved realpaths remain within root.
// - Sends Content-Disposition: attachment to force download behavior.

declare(strict_types=1);

// Start session to maintain compatibility, but close it immediately
// to prevent session locking that would block API requests during download
session_start();
session_write_close();

require_once __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'nanocloud_lib.php';

$uploadDir = STORAGE_ROOT;
$uploadDirReal = realpath($uploadDir);
if ($uploadDirReal === false) {
    http_response_code(500);
    echo 'Storage root not available.';
    exit;
}

// Input: ?path=relative/subdir (optional), ?file=name (required)
$rel = normalize_rel_path($_GET['path'] ?? '');
$file = $_GET['file'] ?? '';

if ($file === '') {
    http_response_code(400);
    echo 'Missing file parameter.';
    exit;
}

$sanitizedFile = sanitize_segment($file);
if ($sanitizedFile === '') {
    http_response_code(400);
    echo 'Invalid filename.';
    exit;
}

// Resolve directory realpath
$dirReal = $uploadDirReal;
if ($rel !== '') {
    $candidateDir = $uploadDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rel);
    $resolvedDir = realpath($candidateDir);
    if ($resolvedDir === false || !is_dir($resolvedDir)) {
        http_response_code(404);
        echo 'Path not found.';
        exit;
    }
    if (!is_within_root($uploadDirReal, $resolvedDir)) {
        http_response_code(400);
        echo 'Invalid path.';
        exit;
    }
    $dirReal = $resolvedDir;
}

// Build file path and validate
$path = $dirReal . DIRECTORY_SEPARATOR . $sanitizedFile;
$pathReal = realpath($path);
if ($pathReal === false || !is_file($pathReal)) {
    http_response_code(404);
    echo 'File not found.';
    exit;
}
if (!is_within_root($uploadDirReal, $pathReal)) {
    http_response_code(400);
    echo 'Invalid file path.';
    exit;
}

// Detect MIME type, fallback to octet-stream
$mime = 'application/octet-stream';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
        $detected = finfo_file($finfo, $pathReal);
        if ($detected !== false) {
            $mime = $detected;
        }
        finfo_close($finfo);
    }
}

header('Content-Description: File Transfer');

// Determine if this file type should be rendered inline by the browser (images/audio/video/pdf)
$ext = strtolower(pathinfo($sanitizedFile, PATHINFO_EXTENSION));
$openableExts = ['jpg','jpeg','png','gif','webp','bmp','svg','mp4','webm','ogg','mp3','wav','flac','aac','pdf'];

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($pathReal));
header('Cache-Control: private, max-age=0, must-revalidate');
header('Pragma: public');

if (in_array($ext, $openableExts, true)) {
    // Allow browser to open inline (no forced download)
    header('Content-Disposition: inline; filename="' . $sanitizedFile . '"');
} else {
    // Force download for all other file types (including MKV, AVI, etc.)
    header('Content-Disposition: attachment; filename="' . $sanitizedFile . '"');
    header('Content-Transfer-Encoding: binary');
}

// Enable ignore_user_abort to allow cleanup on disconnect
ignore_user_abort(true);

// Stream file with enhanced client disconnect detection
$fp = fopen($pathReal, 'rb');
if ($fp !== false) {
    // Set a reasonable chunk size (64KB for better performance)
    $chunkSize = 65536;
    
    // Track bytes sent for rate limiting (optional)
    $bytesSent = 0;
    $startTime = microtime(true);
    
    // Maximum transfer rate in bytes per second (0 = unlimited)
    // Read from configuration
    $maxBytesPerSecond = DOWNLOAD_RATE_LIMIT_MB * 1024 * 1024;
    
    while (!feof($fp)) {
        // Enhanced client disconnect detection
        if (connection_aborted()) {
            fclose($fp);
            // Log disconnect if needed
            error_log("Client disconnected during file transfer: {$sanitizedFile}");
            exit;
        }
        
        // Additional connection status check
        if (connection_status() != CONNECTION_NORMAL) {
            fclose($fp);
            error_log("Connection status abnormal during file transfer: {$sanitizedFile}");
            exit;
        }
        
        // Read and send chunk
        $data = fread($fp, $chunkSize);
        if ($data === false) {
            break;
        }
        
        echo $data;
        $bytesSent += strlen($data);
        
        // Flush output buffers to detect disconnects faster
        if (ob_get_level() > 0) {
            @ob_flush();
        }
        @flush();
        
        // Check for disconnect after flush
        if (connection_aborted()) {
            fclose($fp);
            error_log("Client disconnected after flush: {$sanitizedFile}");
            exit;
        }
        
        // Rate limiting: calculate if we need to sleep
        if ($maxBytesPerSecond > 0) {
            $elapsedTime = microtime(true) - $startTime;
            $expectedTime = $bytesSent / $maxBytesPerSecond;
            
            if ($expectedTime > $elapsedTime) {
                // We're sending too fast, sleep for the difference
                $sleepTime = ($expectedTime - $elapsedTime) * 1000000; // Convert to microseconds
                if ($sleepTime > 0) {
                    usleep((int)$sleepTime);
                }
            }
        }
        
        // More frequent disconnect checks (every 256KB)
        if ($bytesSent % 262144 === 0) {
            if (connection_aborted()) {
                fclose($fp);
                error_log("Client disconnected at checkpoint: {$sanitizedFile}");
                exit;
            }
        }
    }
    
    fclose($fp);
}

exit;
