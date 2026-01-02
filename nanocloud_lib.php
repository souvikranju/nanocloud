<?php
// nanocloud_lib.php
// Shared helpers for the upload app: sanitizers, path resolvers, JSON helpers, storage info, recursive remove, etc.

declare(strict_types=1);

/** Send JSON response with appropriate header. */
function send_json(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/** Sanitize a filename (single file name, not a path). */
function sanitize_filename(string $name): string
{
    $name = basename($name);
    // Allow parentheses, square brackets and plus in filenames (preserve common characters)
    $name = preg_replace('/[^A-Za-z0-9._ \-\(\)\[\]\+]/', '_', $name);
    $name = trim($name);

    if ($name === '' || $name === '.' || $name === '..') {
        $name = 'file_' . time();
    }

    return $name;
}

/** Sanitize a single path segment (folder or file segment without slashes). */
function sanitize_segment(string $seg): string
{
    $seg = str_replace(['\\', '/'], '_', $seg);
    // Allow parentheses, square brackets and plus in path segments
    $seg = preg_replace('/[^A-Za-z0-9._ \-\(\)\[\]\+]/', '_', $seg);
    $seg = trim($seg);
    if ($seg === '' || $seg === '.' || $seg === '..') {
        return '';
    }
    return $seg;
}

/** Normalize a relative path "a/b\c" -> "a/b/c", sanitize each segment, drop empties. */
function normalize_rel_path(?string $rel): string
{
    if ($rel == null) return '';
    $rel = str_replace('\\', '/', $rel);
    $parts = explode('/', $rel);
    $clean = [];
    foreach ($parts as $p) {
        $s = sanitize_segment($p);
        if ($s !== '') {
            $clean[] = $s;
        }
    }
    return implode('/', $clean);
}

/** Check if $path is within $rootReal using prefix compare. */
function is_within_root(string $rootReal, string $path): bool
{
    $root = rtrim(strtolower(str_replace('\\', '/', $rootReal)), '/');
    $p    = strtolower(str_replace('\\', '/', $path));
    return str_starts_with($p, $root . '/') || $p === $root;
}

/** Resolve a normalized relative path to an absolute directory inside root. */
function resolve_dir(string $rootReal, string $root, string $relNormalized): ?array
{
    if ($relNormalized === '') {
        return ['abs' => $rootReal, 'rel' => ''];
    }
    $candidate = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relNormalized);
    $real = realpath($candidate);
    if ($real === false || !is_dir($real)) {
        return null;
    }
    if (!is_within_root($rootReal, $real)) {
        return null;
    }
    return ['abs' => $real, 'rel' => $relNormalized];
}

/** Breadcrumbs array for a normalized relative path. */
function breadcrumbs_for(string $relNormalized): array
{
    if ($relNormalized === '') return [];
    return explode('/', $relNormalized);
}

/** Storage info (bytes) */
function storage_info(string $dir): array
{
    $total = @disk_total_space($dir);
    $free  = @disk_free_space($dir);
    if ($total === false) $total = 0;
    if ($free === false) $free = 0;
    $used = max(0, $total - $free);
    $percent = ($total > 0) ? ($used / $total * 100.0) : 0.0;

    return [
        'totalBytes'  => (int)$total,
        'freeBytes'   => (int)$free,
        'usedBytes'   => (int)$used,
        'usedPercent' => $percent,
    ];
}

/** Recursive delete directory contents and the directory itself. */
function rrmdir(string $dir): bool
{
    if (!is_dir($dir)) return false;

    $items = @scandir($dir);
    if ($items === false) return false;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            if (!rrmdir($path)) return false;
        } else {
            if (!@unlink($path)) return false;
        }
    }
    return @rmdir($dir);
}

/** Convert PHP upload error codes to readable messages. */
function upload_error_message(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'File is larger than the server allows (php.ini limit).';
        case UPLOAD_ERR_PARTIAL:
            return 'File was only partially uploaded.';
        case UPLOAD_ERR_NO_FILE:
            return 'No file was uploaded.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Missing a temporary folder on server.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Failed to write file to disk.';
        case UPLOAD_ERR_EXTENSION:
            return 'Upload stopped by a server extension.';
        default:
            return 'Unknown upload error.';
    }
}

/**
 * Apply configured permissions and ownership to a file or directory.
 * 
 * @param string $path Path to the file or directory
 * @param bool $isDir Whether the path is a directory (true) or file (false)
 * @return void
 */
function apply_permissions(string $path, bool $isDir = false): void
{
    // Apply permissions based on type
    $perms = $isDir ? DIR_PERMISSIONS : FILE_PERMISSIONS;
    @chmod($path, $perms);
    
    // Apply ownership if configured (requires appropriate server permissions)
    if (defined('FILE_OWNER') && FILE_OWNER !== null) {
        @chown($path, FILE_OWNER);
    }
    
    if (defined('FILE_GROUP') && FILE_GROUP !== null) {
        @chgrp($path, FILE_GROUP);
    }
}
