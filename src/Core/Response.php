<?php
/**
 * HTTP Response Builder
 * 
 * Provides methods to send JSON responses with proper headers
 * and consistent structure.
 */

declare(strict_types=1);

namespace NanoCloud\Core;

class Response
{
    /**
     * Send a JSON response and exit
     * 
     * @param array $data Response data
     * @param int $statusCode HTTP status code
     */
    public static function json(array $data, int $statusCode = 200): never
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
        exit;
    }
    
    /**
     * Send a success response
     * 
     * @param string $message Success message
     * @param array $data Additional data
     */
    public static function success(string $message, array $data = []): never
    {
        self::json(array_merge([
            'success' => true,
            'message' => $message
        ], $data));
    }
    
    /**
     * Send an error response
     * 
     * @param string $message Error message
     * @param int $statusCode HTTP status code
     * @param array $data Additional data
     */
    public static function error(string $message, int $statusCode = 400, array $data = []): never
    {
        self::json(array_merge([
            'success' => false,
            'message' => $message
        ], $data), $statusCode);
    }
    
    /**
     * Send a not found response
     * 
     * @param string $message Error message
     */
    public static function notFound(string $message = 'Resource not found'): never
    {
        self::error($message, 404);
    }
    
    /**
     * Send a forbidden response
     * 
     * @param string $message Error message
     */
    public static function forbidden(string $message = 'Operation not allowed'): never
    {
        self::error($message, 403);
    }
    
    /**
     * Send a server error response
     * 
     * @param string $message Error message
     */
    public static function serverError(string $message = 'Internal server error'): never
    {
        self::error($message, 500);
    }
}
