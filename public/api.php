<?php
/**
 * NanoCloud API Router
 * 
 * Main API endpoint that routes requests to appropriate service methods.
 * Handles all CRUD operations for files and directories.
 */

declare(strict_types=1);

// Start session
session_start();

// Load autoloader and configuration
require_once dirname(__DIR__) . '/src/autoload.php';
require_once dirname(__DIR__) . '/src/Helpers/functions.php';

use NanoCloud\Core\Config;
use NanoCloud\Core\Request;
use NanoCloud\Core\Response;
use NanoCloud\Services\DirectoryService;
use NanoCloud\Services\FileService;
use NanoCloud\Services\UploadService;
use NanoCloud\Services\StorageService;

// Load configuration
Config::load();

// Close session early to prevent blocking
session_write_close();

// Ensure storage directory exists
$storageRoot = Config::get('STORAGE_ROOT');
if (!is_dir($storageRoot)) {
    if (!@mkdir($storageRoot, Config::get('DIR_PERMISSIONS'), true)) {
        Response::serverError('Unable to create storage directory.');
    }
}

// Get action from request
$action = Request::input('action', 'list');

// Route to appropriate handler
try {
    match($action) {
        'list' => handleList(),
        'upload' => handleUpload(),
        'upload_chunk' => handleUploadChunk(),
        'upload_check' => handleUploadCheck(),
        'delete' => handleDelete(),
        'create_dir' => handleCreateDir(),
        'delete_dir' => handleDeleteDir(),
        'rename_file' => handleRenameFile(),
        'rename_dir' => handleRenameDir(),
        'move' => handleMove(),
        'info' => handleInfo(),
        default => Response::error('Unknown action.')
    };
} catch (Throwable $e) {
    // Return structured error for debugging
    Response::serverError('Server error: ' . $e->getMessage());
}

/**
 * Handle directory listing
 */
function handleList(): never
{
    $path = Request::input('path', '');
    
    $service = new DirectoryService();
    $result = $service->listDirectory($path);
    
    Response::json($result);
}

/**
 * Handle file upload
 */
function handleUpload(): never
{
    $path = Request::post('path', '');
    
    $service = new UploadService();
    $result = $service->handleUpload($path);
    
    Response::json($result);
}

/**
 * Handle chunked file upload
 */
function handleUploadChunk(): never
{
    $uploadId = Request::post('uploadId', '');
    $chunkIndex = Request::post('chunkIndex', '');
    $totalChunks = Request::post('totalChunks', '');
    $filename = Request::post('filename', '');
    $relativePath = Request::post('relativePath', '');
    $path = Request::post('path', '');
    
    if ($uploadId === '' || $chunkIndex === '' || $totalChunks === '' || $filename === '') {
        Response::error('Missing required chunk parameters.');
    }
    
    $service = new UploadService();
    $result = $service->handleChunk(
        $uploadId,
        (int)$chunkIndex,
        (int)$totalChunks,
        $filename,
        $relativePath,
        $path
    );
    
    Response::json($result);
}

/**
 * Handle upload status check (for resumability)
 */
function handleUploadCheck(): never
{
    $uploadId = Request::post('uploadId', '');
    
    if ($uploadId === '') {
        Response::error('Missing upload ID.');
    }
    
    $service = new UploadService();
    $result = $service->checkUploadStatus($uploadId);
    
    Response::json($result);
}

/**
 * Handle file deletion
 */
function handleDelete(): never
{
    $path = Request::post('path', '');
    $filename = Request::post('filename', '');
    
    if ($filename === '') {
        Response::error('Missing filename.');
    }
    
    $service = new FileService();
    $result = $service->deleteFile($path, $filename);
    
    Response::json($result);
}

/**
 * Handle directory creation
 */
function handleCreateDir(): never
{
    $path = Request::post('path', '');
    $name = Request::post('name', '');
    
    if ($name === '') {
        Response::error('Missing directory name.');
    }
    
    $service = new DirectoryService();
    $result = $service->createDirectory($path, $name);
    
    Response::json($result);
}

/**
 * Handle directory deletion
 */
function handleDeleteDir(): never
{
    $path = Request::post('path', '');
    $name = Request::post('name', '');
    
    if ($name === '') {
        Response::error('Missing directory name.');
    }
    
    $service = new DirectoryService();
    $result = $service->deleteDirectory($path, $name);
    
    Response::json($result);
}

/**
 * Handle file rename
 */
function handleRenameFile(): never
{
    $path = Request::post('path', '');
    $filename = Request::post('filename', '');
    $newName = Request::post('newName', '');
    
    if ($filename === '' || $newName === '') {
        Response::error('Missing filename or new name.');
    }
    
    $service = new FileService();
    $result = $service->renameFile($path, $filename, $newName);
    
    Response::json($result);
}

/**
 * Handle directory rename
 */
function handleRenameDir(): never
{
    $path = Request::post('path', '');
    $name = Request::post('name', '');
    $newName = Request::post('newName', '');
    
    if ($name === '' || $newName === '') {
        Response::error('Missing name or new name.');
    }
    
    $service = new DirectoryService();
    $result = $service->renameDirectory($path, $name, $newName);
    
    Response::json($result);
}

/**
 * Handle move operation
 */
function handleMove(): never
{
    $path = Request::post('path', '');
    $itemType = Request::post('itemType', '');
    $itemName = Request::post('itemName', '');
    $targetPath = Request::post('targetPath');
    
    if ($itemType === '' || $itemName === '' || $targetPath === null) {
        Response::error('Missing required parameters.');
    }
    
    $service = new FileService();
    $result = $service->moveItem($path, $itemType, $itemName, $targetPath);
    
    Response::json($result);
}

/**
 * Handle system info request
 */
function handleInfo(): never
{
    $storageService = new StorageService();
    
    Response::json([
        'success' => true,
        'readOnly' => Config::get('READ_ONLY'),
        'uploadEnabled' => Config::get('UPLOAD_ENABLED'),
        'deleteEnabled' => Config::get('DELETE_ENABLED'),
        'renameEnabled' => Config::get('RENAME_ENABLED'),
        'moveEnabled' => Config::get('MOVE_ENABLED'),
        'storage' => $storageService->getStorageInfo()
    ]);
}
