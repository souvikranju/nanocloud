<?php
// nanocloud_update_api.php
// Self-update system for NanoCloud
// Handles version checking, downloading updates from GitHub, and applying them

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'nanocloud_lib.php';

// GitHub repository (hardcoded for security)
define('GITHUB_REPO', 'souvikranju/nanocloud');

// Configuration
define('VERSION_FILE', __DIR__ . '/version.json');
define('TEMP_DIR', __DIR__ . '/.temp');
define('BACKUP_DIR', TEMP_DIR . '/backup');
define('DOWNLOAD_DIR', TEMP_DIR . '/update_download');
define('STAGING_DIR', TEMP_DIR . '/update_staging');
define('LOCK_FILE', TEMP_DIR . '/update.lock');
define('UPDATE_TIMEOUT', 600); // 10 minutes

// Files/directories to preserve during update
$PRESERVE_PATHS = [
    'config.local.php',
    'uploads',
    '.temp',
    '.git',
    '.gitignore',
];

// Core files that must exist after update
$REQUIRED_FILES = [
    'index.php',
    'nanocloud_api.php',
    'nanocloud_lib.php'
];

/**
 * Get current version from version.json
 */
function get_current_version(): ?array
{
    if (!file_exists(VERSION_FILE)) {
        return null;
    }
    
    $content = @file_get_contents(VERSION_FILE);
    if ($content === false) {
        return null;
    }
    
    $data = @json_decode($content, true);
    return $data ?: null;
}

/**
 * Check for updates from GitHub
 */
function check_for_updates(): array
{
    $current = get_current_version();
    if (!$current) {
        return [
            'success' => false,
            'message' => 'Could not read current version'
        ];
    }
    
    $url = "https://api.github.com/repos/" . GITHUB_REPO . "/releases/latest";
    
    // Create stream context with headers and options
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => 'User-Agent: NanoCloud-Updater',
            'timeout' => 10,
            'follow_location' => 1,
            'ignore_errors' => true
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true
        ]
    ]);
    
    $response = @file_get_contents($url, false, $context);
    
    // Check HTTP response code (use last header after following redirects)
    $httpCode = 200;
    if (isset($http_response_header) && count($http_response_header) > 0) {
        $lastHeader = $http_response_header[count($http_response_header) - 1];
        preg_match('/HTTP\/\d\.\d\s+(\d+)/', $lastHeader, $matches);
        $httpCode = (int)($matches[1] ?? 200);
    }
    
    if ($response === false || $httpCode !== 200) {
        return [
            'success' => false,
            'message' => 'Failed to check for updates: HTTP ' . $httpCode
        ];
    }
    
    $release = @json_decode($response, true);
    if (!$release || !isset($release['tag_name'])) {
        return [
            'success' => false,
            'message' => 'Invalid response from GitHub'
        ];
    }
    
    $latestVersion = $release['tag_name'];
    $currentVersion = $current['version'];
    
    // Compare versions
    $updateAvailable = version_compare(
        ltrim($latestVersion, 'v'),
        ltrim($currentVersion, 'v'),
        '>'
    );
    
    return [
        'success' => true,
        'current_version' => $currentVersion,
        'latest_version' => $latestVersion,
        'update_available' => $updateAvailable,
        'download_url' => $release['zipball_url'] ?? null,
        'release_notes' => $release['body'] ?? '',
        'published_at' => $release['published_at'] ?? null
    ];
}

/**
 * Check if update is already in progress
 */
function is_update_locked(): bool
{
    if (!file_exists(LOCK_FILE)) {
        return false;
    }
    
    // Check if lock is stale (older than timeout)
    $lockTime = @filemtime(LOCK_FILE);
    if ($lockTime && (time() - $lockTime) > UPDATE_TIMEOUT) {
        // Remove stale lock
        @unlink(LOCK_FILE);
        return false;
    }
    
    return true;
}

/**
 * Create update lock
 */
function create_lock(): bool
{
    if (!is_dir(TEMP_DIR)) {
        @mkdir(TEMP_DIR, 0755, true);
    }
    return @file_put_contents(LOCK_FILE, time()) !== false;
}

/**
 * Remove update lock
 */
function remove_lock(): void
{
    @unlink(LOCK_FILE);
}

/**
 * Create backup of current installation
 */
function create_backup(): array
{
    global $PRESERVE_PATHS;
    
    // Ensure backup directory exists
    if (!is_dir(BACKUP_DIR)) {
        if (!@mkdir(BACKUP_DIR, 0755, true)) {
            return ['success' => false, 'message' => 'Failed to create backup directory'];
        }
    }
    
    $backupFile = BACKUP_DIR . '/nanocloud_backup.zip';
    
    // Remove old backup if exists
    if (file_exists($backupFile)) {
        @unlink($backupFile);
    }
    
    try {
        $phar = new PharData($backupFile);
        
        // Add files to backup (exclude preserved paths)
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator(__DIR__, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($files as $file) {
            $filePath = $file->getRealPath();
            $relativePath = substr($filePath, strlen(__DIR__) + 1);
            
            // Skip preserved paths
            $shouldSkip = false;
            foreach ($PRESERVE_PATHS as $preservePath) {
                if (strpos($relativePath, $preservePath) === 0) {
                    $shouldSkip = true;
                    break;
                }
            }
            
            if ($shouldSkip) {
                continue;
            }
            
            if (!$file->isDir()) {
                $phar->addFile($filePath, $relativePath);
            }
        }
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Failed to create backup archive: ' . $e->getMessage()];
    }
    
    if (!file_exists($backupFile)) {
        return ['success' => false, 'message' => 'Backup file was not created'];
    }
    
    return [
        'success' => true,
        'message' => 'Backup created successfully',
        'backup_file' => $backupFile,
        'backup_size' => filesize($backupFile)
    ];
}

/**
 * Download update from GitHub
 */
function download_update(string $downloadUrl): array
{
    // Ensure download directory exists
    if (!is_dir(DOWNLOAD_DIR)) {
        if (!@mkdir(DOWNLOAD_DIR, 0755, true)) {
            return ['success' => false, 'message' => 'Failed to create download directory'];
        }
    }
    
    $zipFile = DOWNLOAD_DIR . '/update.zip';
    
    // Remove old download if exists
    if (file_exists($zipFile)) {
        @unlink($zipFile);
    }
    
    // Create stream context for download
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => 'User-Agent: NanoCloud-Updater',
            'timeout' => 300,
            'follow_location' => 1,
            'ignore_errors' => true
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true
        ]
    ]);
    
    // Download file content
    $content = @file_get_contents($downloadUrl, false, $context);
    
    // Check HTTP response code (use last header after following redirects)
    $httpCode = 200;
    if (isset($http_response_header) && count($http_response_header) > 0) {
        $lastHeader = $http_response_header[count($http_response_header) - 1];
        preg_match('/HTTP\/\d\.\d\s+(\d+)/', $lastHeader, $matches);
        $httpCode = (int)($matches[1] ?? 200);
    }
    
    if ($content === false || $httpCode !== 200) {
        return [
            'success' => false,
            'message' => 'Failed to download update: HTTP ' . $httpCode
        ];
    }
    
    // Write content to file
    if (@file_put_contents($zipFile, $content) === false) {
        return [
            'success' => false,
            'message' => 'Failed to save downloaded file'
        ];
    }
    
    // Verify ZIP file
    try {
        $phar = new PharData($zipFile);
        unset($phar); // Release file handle
    } catch (Exception $e) {
        @unlink($zipFile);
        return ['success' => false, 'message' => 'Downloaded file is not a valid ZIP archive'];
    }
    
    return [
        'success' => true,
        'message' => 'Update downloaded successfully',
        'file' => $zipFile,
        'size' => filesize($zipFile)
    ];
}

/**
 * Extract update to staging directory
 */
function extract_update(string $zipFile): array
{
    global $REQUIRED_FILES;
    
    // Clean staging directory
    if (is_dir(STAGING_DIR)) {
        rrmdir(STAGING_DIR);
    }
    
    if (!@mkdir(STAGING_DIR, 0755, true)) {
        return ['success' => false, 'message' => 'Failed to create staging directory'];
    }
    
    try {
        $phar = new PharData($zipFile);
        $phar->extractTo(STAGING_DIR);
        unset($phar); // Release file handle
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Failed to extract update: ' . $e->getMessage()];
    }
    
    // GitHub zipballs have a root directory, find it
    $items = scandir(STAGING_DIR);
    $rootDir = null;
    foreach ($items as $item) {
        if ($item !== '.' && $item !== '..' && is_dir(STAGING_DIR . '/' . $item)) {
            $rootDir = STAGING_DIR . '/' . $item;
            break;
        }
    }
    
    if (!$rootDir) {
        return ['success' => false, 'message' => 'Invalid update structure'];
    }
    
    // Move files from root directory to staging root
    $files = scandir($rootDir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        rename($rootDir . '/' . $file, STAGING_DIR . '/' . $file);
    }
    rmdir($rootDir);
    
    // Verify required files exist
    foreach ($REQUIRED_FILES as $file) {
        if (!file_exists(STAGING_DIR . '/' . $file)) {
            return [
                'success' => false,
                'message' => "Required file missing: {$file}"
            ];
        }
    }
    
    return [
        'success' => true,
        'message' => 'Update extracted successfully'
    ];
}

/**
 * Deploy update from staging to application directory
 */
function deploy_update(): array
{
    global $PRESERVE_PATHS;
    
    // Build rsync exclude options
    $excludes = array_map(fn($path) => "--exclude='{$path}'", $PRESERVE_PATHS);
    $excludeStr = implode(' ', $excludes);
    
    // Use rsync for atomic deployment
    $cmd = sprintf(
        'rsync -av --delete %s %s %s 2>&1',
        $excludeStr,
        escapeshellarg(STAGING_DIR . '/'),
        escapeshellarg(__DIR__ . '/')
    );
    
    exec($cmd, $output, $returnCode);
    
    if ($returnCode !== 0) {
        return [
            'success' => false,
            'message' => 'Deployment failed: ' . implode("\n", $output)
        ];
    }
    
    return [
        'success' => true,
        'message' => 'Update deployed successfully'
    ];
}

/**
 * Update version.json with new version
 */
function update_version_file(string $newVersion): array
{
    $data = [
        'version' => $newVersion,
        'updated' => date('c')
    ];
    
    if (@file_put_contents(VERSION_FILE, json_encode($data, JSON_PRETTY_PRINT)) === false) {
        return ['success' => false, 'message' => 'Failed to update version file'];
    }
    
    return ['success' => true, 'message' => 'Version file updated'];
}

/**
 * Clean up temporary files after successful update
 */
function cleanup_temp_files(): void
{
    if (is_dir(DOWNLOAD_DIR)) {
        rrmdir(DOWNLOAD_DIR);
    }
    if (is_dir(STAGING_DIR)) {
        rrmdir(STAGING_DIR);
    }
}

/**
 * Rollback to backup
 */
function rollback(): array
{
    $backupFile = BACKUP_DIR . '/nanocloud_backup.zip';
    
    if (!file_exists($backupFile)) {
        return ['success' => false, 'message' => 'No backup found'];
    }
    
    // Extract to temporary location first
    $tempExtract = TEMP_DIR . '/rollback_temp';
    
    // Clean temp extraction directory if it exists
    if (is_dir($tempExtract)) {
        rrmdir($tempExtract);
    }
    
    if (!@mkdir($tempExtract, 0755, true)) {
        return ['success' => false, 'message' => 'Failed to create temporary extraction directory'];
    }
    
    try {
        $phar = new PharData($backupFile);
        $phar->extractTo($tempExtract);
        unset($phar); // Release file handle
    } catch (Exception $e) {
        rrmdir($tempExtract);
        return ['success' => false, 'message' => 'Failed to extract backup: ' . $e->getMessage()];
    }
    
    // Copy files from temp to target directory with forced overwrite
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($tempExtract, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    
    foreach ($files as $file) {
        $sourcePath = $file->getRealPath();
        $relativePath = substr($sourcePath, strlen($tempExtract) + 1);
        $targetPath = __DIR__ . '/' . $relativePath;
        
        if ($file->isDir()) {
            // Create directory if it doesn't exist
            if (!is_dir($targetPath)) {
                @mkdir($targetPath, 0755, true);
            }
        } else {
            // Copy file with forced overwrite
            if (!@copy($sourcePath, $targetPath)) {
                rrmdir($tempExtract);
                return [
                    'success' => false,
                    'message' => "Failed to restore file: {$relativePath}"
                ];
            }
        }
    }
    
    // Clean up temporary extraction directory
    rrmdir($tempExtract);
    
    // Verify restoration
    global $REQUIRED_FILES;
    foreach ($REQUIRED_FILES as $file) {
        if (!file_exists(__DIR__ . '/' . $file)) {
            return [
                'success' => false,
                'message' => "Rollback incomplete: {$file} missing"
            ];
        }
    }
    
    return [
        'success' => true,
        'message' => 'Successfully rolled back to previous version'
    ];
}

/**
 * Perform complete update process
 */
function perform_update(): array
{
    // Step 0: Check if target directory is writable
    if (!is_writable(__DIR__)) {
        return [
            'success' => false,
            'message' => 'Target directory is not writable'
        ];
    }
    
    // Step 1: Check for updates and validate
    $updateCheck = check_for_updates();
    if (!$updateCheck['success']) {
        return $updateCheck;
    }
    
    if (!$updateCheck['update_available']) {
        return [
            'success' => false,
            'message' => 'No update available'
        ];
    }
    
    $downloadUrl = $updateCheck['download_url'];
    $newVersion = $updateCheck['latest_version'];
    
    if (!$downloadUrl) {
        return [
            'success' => false,
            'message' => 'Download URL not available'
        ];
    }
    
    // Step 2: Create backup
    $result = create_backup();
    if (!$result['success']) {
        return $result;
    }
    
    // Step 2: Download update
    $result = download_update($downloadUrl);
    if (!$result['success']) {
        return $result;
    }
    $zipFile = $result['file'];
    
    // Step 3: Extract to staging
    $result = extract_update($zipFile);
    if (!$result['success']) {
        return $result;
    }
    
    // Step 4: Deploy update
    $result = deploy_update();
    if (!$result['success']) {
        // Attempt rollback
        rollback();
        return $result;
    }
    
    // Step 5: Update version file
    $result = update_version_file($newVersion);
    if (!$result['success']) {
        return $result;
    }
    
    // Step 6: Cleanup
    cleanup_temp_files();
    
    return [
        'success' => true,
        'message' => "Successfully updated to {$newVersion}",
        'new_version' => $newVersion
    ];
}

// Action dispatcher
$action = $_GET['action'];

try {
    switch ($action) {
        case 'check_version':
            send_json(check_for_updates());
            break;
            
        case 'start_update':
            // Check if already locked
            if (is_update_locked()) {
                send_json([
                    'success' => false,
                    'message' => 'Update already in progress'
                ]);
            }
            
            // Create lock
            if (!create_lock()) {
                send_json([
                    'success' => false,
                    'message' => 'Failed to create update lock'
                ]);
            }
            
            // Perform update (backend handles everything internally)
            $result = perform_update();
            
            // Remove lock
            remove_lock();
            
            send_json($result);
            break;
            
        case 'rollback':
            if (is_update_locked()) {
                send_json([
                    'success' => false,
                    'message' => 'Cannot rollback while update is in progress'
                ]);
            }
            
            send_json(rollback());
            break;
            
        case 'get_version':
            $version = get_current_version();
            if (!$version) {
                send_json([
                    'success' => false,
                    'message' => 'Could not read version'
                ]);
            }
            send_json([
                'success' => true,
                'version' => $version
            ]);
            break;
            
        default:
            send_json([
                'success' => false,
                'message' => 'Unknown action'
            ]);
    }
} catch (Throwable $e) {
    // Remove lock on error
    remove_lock();
    
    send_json([
        'success' => false,
        'message' => 'Update error: ' . $e->getMessage()
    ]);
}
