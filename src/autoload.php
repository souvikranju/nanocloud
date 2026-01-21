<?php
/**
 * PSR-4 Autoloader for NanoCloud
 * 
 * Simple autoloader without external dependencies.
 * Maps NanoCloud\* namespace to src/ directory.
 */

declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    // Project namespace prefix
    $prefix = 'NanoCloud\\';
    
    // Base directory for the namespace prefix
    $base_dir = __DIR__ . '/';
    
    // Check if the class uses the namespace prefix
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        // No, move to the next registered autoloader
        return;
    }
    
    // Get the relative class name
    $relative_class = substr($class, $len);
    
    // Replace namespace separators with directory separators
    // and append .php
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    
    // If the file exists, require it
    if (file_exists($file)) {
        require $file;
    }
});
