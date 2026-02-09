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
}
