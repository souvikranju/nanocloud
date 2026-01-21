<?php
/**
 * Configuration Manager
 * 
 * Loads and manages application configuration with support for
 * default values and local overrides.
 */

declare(strict_types=1);

namespace NanoCloud\Core;

class Config
{
    /**
     * Configuration storage
     */
    private static array $config = [];
    
    /**
     * Whether configuration has been loaded
     */
    private static bool $loaded = false;
    
    /**
     * Load configuration from files
     * 
     * Loads defaults first, then applies local overrides if they exist.
     * Also calculates derived values like MAX_FILE_BYTES.
     */
    public static function load(): void
    {
        if (self::$loaded) {
            return;
        }
        
        $configDir = dirname(__DIR__, 2) . '/config';
        
        // Load defaults
        require $configDir . '/defaults.php';
        
        // Store default values
        self::$config = get_defined_vars();
        
        // Load local overrides if they exist
        $localConfig = $configDir . '/local.php';
        if (file_exists($localConfig)) {
            require $localConfig;
            // Merge local values
            self::$config = array_merge(self::$config, get_defined_vars());
        }
        
        // Calculate MAX_FILE_BYTES from PHP settings and user-defined limit
        $uploadMax = self::parseSizeToBytes(ini_get('upload_max_filesize'));
        $postMax = self::parseSizeToBytes(ini_get('post_max_size'));
        $userMax = self::$config['USER_DEFINED_MAX_FILE_SIZE'] ?? PHP_INT_MAX;
        
        self::$config['MAX_FILE_BYTES'] = min($userMax, $uploadMax, $postMax);
        
        // Set PHP runtime configuration
        ini_set('max_execution_time', '300');
        ini_set('max_input_time', '300');
        
        self::$loaded = true;
    }
    
    /**
     * Get a configuration value
     * 
     * @param string $key Configuration key
     * @param mixed $default Default value if key doesn't exist
     * @return mixed Configuration value
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        if (!self::$loaded) {
            self::load();
        }
        
        return self::$config[$key] ?? $default;
    }
    
    /**
     * Set a configuration value
     * 
     * @param string $key Configuration key
     * @param mixed $value Configuration value
     */
    public static function set(string $key, mixed $value): void
    {
        if (!self::$loaded) {
            self::load();
        }
        
        self::$config[$key] = $value;
    }
    
    /**
     * Get all configuration values
     * 
     * @return array All configuration
     */
    public static function all(): array
    {
        if (!self::$loaded) {
            self::load();
        }
        
        return self::$config;
    }
    
    /**
     * Parse PHP ini size notation to bytes
     * 
     * @param string $size Size string (e.g., "2M", "1G")
     * @return int Size in bytes
     */
    private static function parseSizeToBytes(string $size): int
    {
        $size = trim($size);
        $last = strtolower($size[strlen($size) - 1]);
        $value = (int)$size;
        
        return match($last) {
            'g' => $value * 1024 * 1024 * 1024,
            'm' => $value * 1024 * 1024,
            'k' => $value * 1024,
            default => $value
        };
    }
    
    /**
     * Get the temporary directory path
     * 
     * @return string Temporary directory path
     */
    public static function getTempDir(): string
    {
        return self::get('STORAGE_ROOT') . DIRECTORY_SEPARATOR . '.temp';
    }
}
