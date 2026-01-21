<?php
/**
 * HTTP Request Wrapper
 * 
 * Provides a clean interface to access request data ($_GET, $_POST, $_FILES, etc.)
 * with type safety and convenience methods.
 */

declare(strict_types=1);

namespace NanoCloud\Core;

class Request
{
    /**
     * Get a value from $_GET
     * 
     * @param string $key Parameter name
     * @param mixed $default Default value if not found
     * @return mixed Parameter value
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }
    
    /**
     * Get a value from $_POST
     * 
     * @param string $key Parameter name
     * @param mixed $default Default value if not found
     * @return mixed Parameter value
     */
    public static function post(string $key, mixed $default = null): mixed
    {
        return $_POST[$key] ?? $default;
    }
    
    /**
     * Get a value from $_REQUEST (checks both GET and POST)
     * 
     * @param string $key Parameter name
     * @param mixed $default Default value if not found
     * @return mixed Parameter value
     */
    public static function input(string $key, mixed $default = null): mixed
    {
        return $_REQUEST[$key] ?? $default;
    }
    
    /**
     * Get uploaded files
     * 
     * @param string $key File input name
     * @return array|null Uploaded files or null if not found
     */
    public static function files(string $key): ?array
    {
        return $_FILES[$key] ?? null;
    }
    
    /**
     * Check if request has a specific key
     * 
     * @param string $key Parameter name
     * @return bool True if key exists
     */
    public static function has(string $key): bool
    {
        return isset($_REQUEST[$key]);
    }
    
    /**
     * Get request method
     * 
     * @return string Request method (GET, POST, etc.)
     */
    public static function method(): string
    {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }
    
    /**
     * Check if request is POST
     * 
     * @return bool True if POST request
     */
    public static function isPost(): bool
    {
        return self::method() === 'POST';
    }
    
    /**
     * Check if request is GET
     * 
     * @return bool True if GET request
     */
    public static function isGet(): bool
    {
        return self::method() === 'GET';
    }
    
    /**
     * Get all request data
     * 
     * @return array All request parameters
     */
    public static function all(): array
    {
        return $_REQUEST;
    }
    
    /**
     * Check if client has disconnected
     * 
     * @return bool True if connection aborted
     */
    public static function isAborted(): bool
    {
        return connection_aborted() !== 0;
    }
}
