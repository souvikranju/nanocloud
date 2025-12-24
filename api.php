<?php
// api.php
// JSON API for listing, navigating, uploading and deleting files/directories under a root "uploads" directory.
// Adds: directory support (list/open/up), create/delete directory, storage meter (free/total/used),
// and transactional uploads with rollback cleanup on client disconnect.
//
// Security model:
// - All operations are constrained within $uploadDir.
// - Paths are relative to $uploadDir and sanitized per-segment (no slashes, no ..).
// - We verify resolved realpaths remain within root.
//
// Notes:
// - Per-file and per-session upload caps remain at 2GB.
// - Storage meter uses disk_total_space/disk_free_space for the filesystem hosting the uploads directory.

declare(strict_types=1);

session_start();

require_once __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

// Upload root directory (single configurable place)
$uploadDir = UPLOAD_DIR;
$uploadDirReal = null;

// Ensure upload directory exists, create if not
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        send_json([
            'success' => false,
            'message' => 'Unable to create upload directory.',
        ]);
        exit;
    }
}
$uploadDirReal = realpath($uploadDir);

// Ensure transactional temp dir exists
$tmpDir = get_tmp_dir();
if (!is_dir($tmpDir)) {
    @mkdir($tmpDir, 0755, true);
}
// Helpers moved to lib.php (sanitize, path resolution, storage, send_json, rrmdir, etc.)

/**
 * List items (dirs + files) in a given path.
 */
function handle_list(string $uploadDir, string $uploadDirReal): void
{
    $rel = normalize_rel_path($_GET['path'] ?? '');
    $resolved = resolve_dir($uploadDirReal, $uploadDir, $rel);
    if ($resolved === null) {
        send_json([
            'success' => false,
            'message' => 'Path not found.',
            'items'   => [],
            'path'    => $rel,
            'breadcrumbs' => breadcrumbs_for($rel),
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $dirAbs = $resolved['abs'];
    $items = [];
    $scan = @scandir($dirAbs);
    if ($scan === false) {
        send_json([
            'success' => false,
            'message' => 'Unable to open directory.',
            'items'   => [],
            'path'    => $resolved['rel'],
            'breadcrumbs' => breadcrumbs_for($resolved['rel']),
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $dirs = [];
    $files = [];
    foreach ($scan as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        // Hide hidden files/directories (dot-prefixed) from listings
        if (strlen($entry) > 0 && $entry[0] === '.') continue;
        $path = $dirAbs . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($path)) {
            // Count non-dot entries (optional)
            $count = 0;
            $sub = @scandir($path);
            if (is_array($sub)) {
                foreach ($sub as $e) {
                    if ($e === '.' || $e === '..') continue;
                    if (strlen($e) > 0 && $e[0] === '.') continue;
                    $count++;
                }
            }
            $dirs[] = [
                'name'  => $entry,
                'type'  => 'dir',
                'mtime' => @filemtime($path) ?: null,
                'count' => $count,
            ];
        } elseif (is_file($path)) {
            $files[] = [
                'name'  => $entry,
                'type'  => 'file',
                'size'  => @filesize($path) ?: null,
                'mtime' => @filemtime($path) ?: null,
            ];
        }
    }

    // Sort dirs/files alphabetically
    usort($dirs, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    usort($files, fn($a, $b) => strcasecmp($a['name'], $b['name']));

    $items = array_merge($dirs, $files);

    send_json([
        'success'     => true,
        'message'     => 'OK',
        'items'       => $items,
        'path'        => $resolved['rel'],
        'breadcrumbs' => breadcrumbs_for($resolved['rel']),
        'storage'     => storage_info($uploadDir),
    ]);
}

// Simple action dispatcher: calls the appropriate handler based on `action` param.
$action = $_REQUEST['action'] ?? 'list';
try {
    switch ($action) {
        case 'list':
            handle_list($uploadDir, $uploadDirReal);
            break;
        case 'upload':
            handle_upload($uploadDir, $uploadDirReal, $tmpDir);
            break;
        case 'delete':
            handle_delete($uploadDir, $uploadDirReal);
            break;
        case 'create_dir':
            handle_create_dir($uploadDir, $uploadDirReal);
            break;
        case 'delete_dir':
            handle_delete_dir($uploadDir, $uploadDirReal);
            break;
        case 'info':
            send_json([
                'success' => true,
                'maxFileBytes' => defined('MAX_FILE_BYTES') ? MAX_FILE_BYTES : null,
                'maxSessionBytes' => defined('MAX_SESSION_BYTES') ? MAX_SESSION_BYTES : null,
            ]);
            break;
        default:
            send_json([ 'success' => false, 'message' => 'Unknown action.' ]);
    }
} catch (Throwable $e) {
    // Return structured error rather than raw PHP stack to aid client-side debugging
    send_json([ 'success' => false, 'message' => 'Server error: ' . $e->getMessage() ]);
}

/**
 * Handle uploads into a given path with transactional temp + rollback on abort.
 * - Accepts multiple files via `files[]`.
 * - Validates caps.
 * - Moves to $tmpDir with unique .part name, then atomically renames into target dir when safe.
 * - On client disconnect, temp parts are deleted and finalization is skipped.
 */
function handle_upload(string $uploadDir, string $uploadDirReal, string $tmpDir): void
{
    ignore_user_abort(true); // allow script to continue to handle cleanup when client disconnects

    if (!isset($_FILES['files'])) {
        send_json([
            'success' => false,
            'message' => 'No files provided.',
            'results' => [],
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $rel = normalize_rel_path($_POST['path'] ?? '');
    $resolved = resolve_dir($uploadDirReal, $uploadDir, $rel);
    if ($resolved === null) {
        send_json([
            'success' => false,
            'message' => 'Target path not found.',
            'results' => [],
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }
    $targetDir = $resolved['abs'];

    $files    = $_FILES['files'];
    $names    = is_array($files['name'])     ? $files['name']     : [$files['name']];
    $tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
    $sizes    = is_array($files['size'])     ? $files['size']     : [$files['size']];
    $errors   = is_array($files['error'])    ? $files['error']    : [$files['error']];

    $results = [];
    $sessionTotal =& $_SESSION['uploaded_total_bytes'];

    foreach ($names as $idx => $originalName) {
        $result = [
            'filename' => $originalName,
            'success'  => false,
            'message'  => '',
        ];

        $tmpName = $tmpNames[$idx] ?? '';
        $size    = (int)($sizes[$idx] ?? 0);
        $error   = $errors[$idx] ?? UPLOAD_ERR_NO_FILE;

        // Handle PHP upload errors
        if ($error !== UPLOAD_ERR_OK) {
            $result['message'] = upload_error_message($error);
            $results[] = $result;
            continue;
        }

        // Server-side size check (regardless of php.ini)
        if ($size > MAX_FILE_BYTES) {
            $result['message'] = 'File exceeds maximum allowed size of 2 GB.';
            $results[] = $result;
            continue;
        }

        // Check per-session cumulative limit
        if ($sessionTotal + $size > MAX_SESSION_BYTES) {
            $result['message'] = 'Per-session upload limit of 2 GB exceeded.';
            $results[] = $result;
            continue;
        }

        $sanitized = sanitize_filename($originalName);
        if ($sanitized === '') {
            $result['message'] = 'Invalid filename.';
            $results[] = $result;
            continue;
        }

        $finalPath = $targetDir . DIRECTORY_SEPARATOR . $sanitized;

        // No duplicates
        if (file_exists($finalPath)) {
            $result['message'] = 'A file with the same name already exists.';
            $results[] = $result;
            continue;
        }

        // Disk free space pre-check (prevent starting writes when filesystem is full)
        $free = @disk_free_space($uploadDir);
        if ($free === false) $free = 0;
        if ($free < $size) {
            $result['message'] = 'Insufficient disk space on server.';
            $results[] = $result;
            continue;
        }

        // Validate uploaded file
        if (!is_uploaded_file($tmpName)) {
            $result['message'] = 'Invalid uploaded file.';
            $results[] = $result;
            continue;
        }

        // Transactional move: tmp .part then rename
        $tmpPart = $tmpDir . DIRECTORY_SEPARATOR . (uniqid('up_', true) . '_' . $sanitized . '.part');
        $GLOBALS['inflightTmpPaths'][] = $tmpPart;

        // Move into tmp area
        if (!@move_uploaded_file($tmpName, $tmpPart)) {
            $result['message'] = 'Failed to move uploaded file.';
            // Remove inflight tmp registration if it didn't get created
            if (!file_exists($tmpPart)) {
                $GLOBALS['inflightTmpPaths'] = array_filter($GLOBALS['inflightTmpPaths'], fn($p) => $p !== $tmpPart);
            }
            $results[] = $result;
            continue;
        }

        // If client aborted, rollback tmp and skip finalization
        if (connection_aborted()) {
            @unlink($tmpPart);
            // Remove from inflight
            $GLOBALS['inflightTmpPaths'] = array_filter($GLOBALS['inflightTmpPaths'], fn($p) => $p !== $tmpPart);
            $result['message'] = 'Upload aborted by client; rolled back.';
            $results[] = $result;
            continue;
        }

        // Finalize: atomic rename within same filesystem
        if (!@rename($tmpPart, $finalPath)) {
            // If rename failed, cleanup tmp
            @unlink($tmpPart);
            // Remove from inflight
            $GLOBALS['inflightTmpPaths'] = array_filter($GLOBALS['inflightTmpPaths'], fn($p) => $p !== $tmpPart);
            $result['message'] = 'Failed to finalize uploaded file.';
            $results[] = $result;
            continue;
        }

        // Remove from inflight since rename succeeded
        $GLOBALS['inflightTmpPaths'] = array_filter($GLOBALS['inflightTmpPaths'], fn($p) => $p !== $tmpPart);

        // Update session total only on success
        $sessionTotal += $size;

        $result['success']  = true;
        $result['filename'] = $sanitized;
        $result['message']  = 'File uploaded successfully.';
        $results[] = $result;
    }

    send_json([
        'success'             => true,
        'message'             => 'Upload processed.',
        'results'             => $results,
        'session_total_bytes' => $sessionTotal, // for debugging/UX if desired
        'storage'             => storage_info($uploadDir),
    ]);
}

// upload_error_message provided by lib.php

/**
 * Delete a file by name within a given path.
 * - Accepts POST "filename" and optional "path".
 */
function handle_delete(string $uploadDir, string $uploadDirReal): void
{
    $rel = normalize_rel_path($_POST['path'] ?? '');
    $resolved = resolve_dir($uploadDirReal, $uploadDir, $rel);
    if ($resolved === null) {
        send_json([
            'success' => false,
            'message' => 'Target path not found.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }
    $dirAbs = $resolved['abs'];

    $filename = $_POST['filename'] ?? '';
    if ($filename === '') {
        send_json([
            'success' => false,
            'message' => 'Missing filename.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $sanitized = sanitize_segment($filename);
    if ($sanitized === '') {
        send_json([
            'success' => false,
            'message' => 'Invalid filename.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $path = $dirAbs . DIRECTORY_SEPARATOR . $sanitized;

    if (!is_file($path)) {
        send_json([
            'success' => false,
            'message' => 'File not found.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    if (!@unlink($path)) {
        send_json([
            'success' => false,
            'message' => 'Failed to delete file.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    send_json([
        'success'  => true,
        'message'  => 'File deleted.',
        'filename' => $sanitized,
        'storage'  => storage_info($uploadDir),
    ]);
}

/**
 * Create a directory within a given path.
 * - Accepts POST "name" and optional "path".
 */
function handle_create_dir(string $uploadDir, string $uploadDirReal): void
{
    $rel = normalize_rel_path($_POST['path'] ?? '');
    $resolved = resolve_dir($uploadDirReal, $uploadDir, $rel);
    if ($resolved === null) {
        send_json([
            'success' => false,
            'message' => 'Target path not found.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }
    $dirAbs = $resolved['abs'];

    $name = $_POST['name'] ?? '';
    $segment = sanitize_segment($name);
    if ($segment === '') {
        send_json([
            'success' => false,
            'message' => 'Invalid directory name.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $newDir = $dirAbs . DIRECTORY_SEPARATOR . $segment;
    if (file_exists($newDir)) {
        send_json([
            'success' => false,
            'message' => 'Directory already exists.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    if (!@mkdir($newDir, 0755, false)) {
        send_json([
            'success' => false,
            'message' => 'Failed to create directory.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    send_json([
        'success' => true,
        'message' => 'Directory created.',
        'name'    => $segment,
        'storage' => storage_info($uploadDir),
    ]);
}

/**
 * Delete a directory (recursive) within a given path.
 * - Accepts POST "name" and optional "path".
 */
function handle_delete_dir(string $uploadDir, string $uploadDirReal): void
{
    $rel = normalize_rel_path($_POST['path'] ?? '');
    $resolved = resolve_dir($uploadDirReal, $uploadDir, $rel);
    if ($resolved === null) {
        send_json([
            'success' => false,
            'message' => 'Target path not found.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }
    $dirAbs = $resolved['abs'];

    $name = $_POST['name'] ?? '';
    $segment = sanitize_segment($name);
    if ($segment === '') {
        send_json([
            'success' => false,
            'message' => 'Invalid directory name.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    $target = $dirAbs . DIRECTORY_SEPARATOR . $segment;
    $targetReal = realpath($target);
    if ($targetReal === false || !is_dir($targetReal)) {
        send_json([
            'success' => false,
            'message' => 'Directory not found.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    // Ensure within root
    if (!is_within_root($uploadDirReal, $targetReal)) {
        send_json([
            'success' => false,
            'message' => 'Invalid directory path.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    // Prevent deleting root itself by mistake
    if ($targetReal === $uploadDirReal) {
        send_json([
            'success' => false,
            'message' => 'Cannot delete root directory.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    if (!rrmdir($targetReal)) {
        send_json([
            'success' => false,
            'message' => 'Failed to delete directory.',
            'storage' => storage_info($uploadDir),
        ]);
        return;
    }

    send_json([
        'success' => true,
        'message' => 'Directory deleted.',
        'name'    => $segment,
        'storage' => storage_info($uploadDir),
    ]);
}
