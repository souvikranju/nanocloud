<?php
/**
 * Update API for NanoCloud v2.0
 * 
 * Self-update system that handles:
 * - Version checking from GitHub
 * - Downloading updates
 * - Applying updates with backup/rollback support
 */

declare(strict_types=1);

// GitHub repository
define('GITHUB_REPO', 'souvikranju/nanocloud');

// Paths (adjusted for v2.0 structure)
define('VERSION_FILE', dirname(__DIR__) . '/version.json');
define('TEMP_DIR', dirname(__DIR__) . '/.temp');
define('BACKUP_DIR', TEMP_DIR . '/backup');
define('DOWNLOAD_DIR', TEMP_DIR . '/update_download');
define('STAGING_DIR', TEMP_DIR . '/update_staging');
define('LOCK_FILE', TEMP_DIR . '/update.lock');
define('UPDATE_TIMEOUT', 600); // 10 minutes

// Files/directories to preserve during update
$PRESERVE_PATHS = [
    'config/local.php',
    'storage',
    '.temp',
    '.git',
    '.gitignore',
];

// Files/directories that belong to NanoCloud (Whitelisted for backup)
$NANOCLOUD_PATHS = [
    'src',
    'public',
    'config',
    'docs',
    'index.php',
    'version.json',
    'LICENSE',
    'README.md',
    '.htaccess',
    'lighttpd.conf',
    '.gitignore'
];

// Core files that must exist after update
$REQUIRED_FILES = [
    'public/index.php',
    'public/api.php',
    'public/update_api.php',
    'src/autoload.php',
    'version.json'
];

/**
 * Send JSON response
 */
function send_json(array $data): never
{
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Recursively remove directory
 */
function rrmdir(string $dir): bool
{
    if (!is_dir($dir)) {
        return false;
    }
    
    $items = @scandir($dir);
    if ($items === false) {
        return false;
    }
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        
        if (is_dir($path)) {
            if (!rrmdir($path)) {
                return false;
            }
        } else {
            if (!@unlink($path)) {
                return false;
            }
        }
    }
    
    return @rmdir($dir);
}

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
    
    $httpCode = 200;
    if (isset($http_response_header) && count($http_response_header) > 0) {
        foreach (array_reverse($http_response_header) as $header) {
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/', $header, $matches)) {
                $httpCode = (int)$matches[1];
                break;
            }
        }
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
    
    $lockTime = @filemtime(LOCK_FILE);
    if ($lockTime && (time() - $lockTime) > UPDATE_TIMEOUT) {
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
    global $PRESERVE_PATHS, $NANOCLOUD_PATHS;
    
    if (!is_dir(BACKUP_DIR)) {
        if (!@mkdir(BACKUP_DIR, 0755, true)) {
            return ['success' => false, 'message' => 'Failed to create backup directory'];
        }
    }
    
    $backupFile = BACKUP_DIR . '/nanocloud_backup.zip';
    
    if (file_exists($backupFile)) {
        @unlink($backupFile);
    }
    
    $rootDir = dirname(__DIR__);
    
    try {
        $phar = new PharData($backupFile);
        
        foreach ($NANOCLOUD_PATHS as $path) {
            $fullPath = $rootDir . '/' . $path;
            
            if (!file_exists($fullPath)) {
                continue;
            }
            
            if (is_dir($fullPath)) {
                $files = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($fullPath, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::SELF_FIRST
                );
                
                foreach ($files as $file) {
                    $filePath = $file->getRealPath();
                    $relativePath = substr($filePath, strlen($rootDir) + 1);
                    
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
                    
                    if ($file->isDir()) {
                        $phar->addEmptyDir($relativePath);
                    } else {
                        $phar->addFile($filePath, $relativePath);
                    }
                }
            } else {
                // It's a file
                $shouldSkip = false;
                foreach ($PRESERVE_PATHS as $preservePath) {
                    if ($path === $preservePath) {
                        $shouldSkip = true;
                        break;
                    }
                }
                
                if (!$shouldSkip) {
                    $phar->addFile($fullPath, $path);
                }
            }
        }
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Failed to create backup: ' . $e->getMessage()];
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
    if (!is_dir(DOWNLOAD_DIR)) {
        if (!@mkdir(DOWNLOAD_DIR, 0755, true)) {
            return ['success' => false, 'message' => 'Failed to create download directory'];
        }
    }
    
    $zipFile = DOWNLOAD_DIR . '/update.zip';
    
    if (file_exists($zipFile)) {
        @unlink($zipFile);
    }
    
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
    
    $content = @file_get_contents($downloadUrl, false, $context);
    
    $httpCode = 200;
    if (isset($http_response_header) && count($http_response_header) > 0) {
        foreach (array_reverse($http_response_header) as $header) {
            if (preg_match('/HTTP\/\d\.\d\s+(\d+)/', $header, $matches)) {
                $httpCode = (int)$matches[1];
                break;
            }
        }
    }
    
    if ($content === false || $httpCode !== 200) {
        return ['success' => false, 'message' => 'Failed to download update: HTTP ' . $httpCode];
    }
    
    if (@file_put_contents($zipFile, $content) === false) {
        return ['success' => false, 'message' => 'Failed to save downloaded file'];
    }
    
    try {
        $phar = new PharData($zipFile);
        unset($phar);
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
    
    if (is_dir(STAGING_DIR)) {
        rrmdir(STAGING_DIR);
    }
    
    if (!@mkdir(STAGING_DIR, 0755, true)) {
        return ['success' => false, 'message' => 'Failed to create staging directory'];
    }
    
    try {
        $phar = new PharData($zipFile);
        $phar->extractTo(STAGING_DIR);
        unset($phar);
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
            return ['success' => false, 'message' => "Required file missing: {$file}"];
        }
    }
    
    return ['success' => true, 'message' => 'Update extracted successfully'];
}

/**
 * Deploy update from staging to application directory
 */
function deploy_update(): array
{
    global $PRESERVE_PATHS;
    
    $rootDir = dirname(__DIR__);
    
    $excludes = array_map(fn($path) => "--exclude='{$path}'", $PRESERVE_PATHS);
    $excludeStr = implode(' ', $excludes);
    
    $cmd = sprintf(
        'rsync -av --delete %s %s %s 2>&1',
        $excludeStr,
        escapeshellarg(STAGING_DIR . '/'),
        escapeshellarg($rootDir . '/')
    );
    
    exec($cmd, $output, $returnCode);
    
    if ($returnCode !== 0) {
        return ['success' => false, 'message' => 'Deployment failed: ' . implode("\n", $output)];
    }
    
    return ['success' => true, 'message' => 'Update deployed successfully'];
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
    
    $tempExtract = TEMP_DIR . '/rollback_temp';
    
    if (is_dir($tempExtract)) {
        rrmdir($tempExtract);
    }
    
    if (!@mkdir($tempExtract, 0755, true)) {
        return ['success' => false, 'message' => 'Failed to create temporary extraction directory'];
    }
    
    try {
        $phar = new PharData($backupFile);
        $phar->extractTo($tempExtract);
        unset($phar);
    } catch (Exception $e) {
        rrmdir($tempExtract);
        return ['success' => false, 'message' => 'Failed to extract backup: ' . $e->getMessage()];
    }
    
    $rootDir = dirname(__DIR__);
    
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($tempExtract, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    
    foreach ($files as $file) {
        $sourcePath = $file->getRealPath();
        $relativePath = substr($sourcePath, strlen($tempExtract) + 1);
        $targetPath = $rootDir . '/' . $relativePath;
        
        if ($file->isDir()) {
            if (!is_dir($targetPath)) {
                @mkdir($targetPath, 0755, true);
            }
        } else {
            if (!@copy($sourcePath, $targetPath)) {
                rrmdir($tempExtract);
                return ['success' => false, 'message' => "Failed to restore file: {$relativePath}"];
            }
        }
    }
    
    rrmdir($tempExtract);
    
    global $REQUIRED_FILES;
    foreach ($REQUIRED_FILES as $file) {
        if (!file_exists($rootDir . '/' . $file)) {
            return ['success' => false, 'message' => "Rollback incomplete: {$file} missing"];
        }
    }
    
    return ['success' => true, 'message' => 'Successfully rolled back to previous version'];
}

/**
 * Perform complete update process
 */
function perform_update(): array
{
    $rootDir = dirname(__DIR__);
    
    if (!is_writable($rootDir)) {
        return ['success' => false, 'message' => 'Target directory is not writable'];
    }
    
    $updateCheck = check_for_updates();
    if (!$updateCheck['success']) {
        return $updateCheck;
    }
    
    if (!$updateCheck['update_available']) {
        return ['success' => false, 'message' => 'No update available'];
    }
    
    $downloadUrl = $updateCheck['download_url'];
    $newVersion = $updateCheck['latest_version'];
    
    if (!$downloadUrl) {
        return ['success' => false, 'message' => 'Download URL not available'];
    }
    
    $result = create_backup();
    if (!$result['success']) {
        return $result;
    }
    
    $result = download_update($downloadUrl);
    if (!$result['success']) {
        return $result;
    }
    $zipFile = $result['file'];
    
    $result = extract_update($zipFile);
    if (!$result['success']) {
        return $result;
    }
    
    $result = deploy_update();
    if (!$result['success']) {
        rollback();
        return $result;
    }
    
    $result = update_version_file($newVersion);
    if (!$result['success']) {
        return $result;
    }
    
    cleanup_temp_files();
    
    return [
        'success' => true,
        'message' => "Successfully updated to {$newVersion}",
        'new_version' => $newVersion
    ];
}

// Action dispatcher
$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'check_version':
            send_json(check_for_updates());
            break;
            
        case 'start_update':
            if (is_update_locked()) {
                send_json(['success' => false, 'message' => 'Update already in progress']);
            }
            
            if (!create_lock()) {
                send_json(['success' => false, 'message' => 'Failed to create update lock']);
            }
            
            $result = perform_update();
            remove_lock();
            send_json($result);
            break;
            
        case 'rollback':
            if (is_update_locked()) {
                send_json(['success' => false, 'message' => 'Cannot rollback while update is in progress']);
            }
            send_json(rollback());
            break;
            
        case 'get_version':
            $version = get_current_version();
            if (!$version) {
                send_json(['success' => false, 'message' => 'Could not read version']);
            }
            send_json(['success' => true, 'version' => $version]);
            break;
            
        default:
            send_json(['success' => false, 'message' => 'Unknown action']);
    }
} catch (Throwable $e) {
    remove_lock();
    send_json(['success' => false, 'message' => 'Update error: ' . $e->getMessage()]);
}
