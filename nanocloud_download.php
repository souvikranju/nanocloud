<?php
 // nanocloud_download.php
// Serves files for download from the uploads directory, supporting nested directories securely.
// Security:
// - Only serves files from the configured uploads directory.
// - Sanitizes path segments and filename (no directory traversal).
// - Verifies resolved realpaths remain within root.
// - Sends Content-Disposition: attachment to force download behavior.

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'nanocloud_lib.php';

$uploadDir = UPLOAD_DIR;
$uploadDirReal = realpath($uploadDir);
if ($uploadDirReal === false) {
    http_response_code(500);
    echo 'Upload root not available.';
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

// Determine if this file type should be rendered inline by the browser (images/audio/video)
$ext = strtolower(pathinfo($sanitizedFile, PATHINFO_EXTENSION));
$openableExts = ['jpg','jpeg','png','gif','webp','bmp','svg','mp4','webm','ogg','mov','mkv','mp3','wav','flac','aac'];

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($pathReal));
header('Cache-Control: private, max-age=0, must-revalidate');
header('Pragma: public');

if (in_array($ext, $openableExts, true)) {
    // Allow browser to open inline (no forced download)
    header('Content-Disposition: inline; filename="' . $sanitizedFile . '"');
} else {
    // Force download for non-supported types
    header('Content-Disposition: attachment; filename="' . $sanitizedFile . '"');
    header('Content-Transfer-Encoding: binary');
}

$fp = fopen($pathReal, 'rb');
if ($fp !== false) {
    while (!feof($fp)) {
        echo fread($fp, 8192);
        @ob_flush();
        flush();
    }
    fclose($fp);
}
exit;
