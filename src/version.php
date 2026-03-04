<?php
/**
 * Version Helper
 *
 * Standalone, autoloader-independent helper for reading version.json.
 *
 * This file is intentionally kept free of namespaces and framework
 * dependencies so it can be required directly by any PHP entry point:
 *
 *   - index.php          (root redirector)
 *   - public/index.php   (application shell)
 *   - public/update_api.php (self-update system)
 *
 * Definition guards make it safe to require the file more than once.
 */

if (!defined('VERSION_FILE')) {
    // Resolves to <project-root>/version.json regardless of which file
    // includes this helper (__DIR__ here is always src/).
    define('VERSION_FILE', dirname(__DIR__) . '/version.json');
}

if (!function_exists('get_current_version')) {
    /**
     * Read and parse version.json.
     *
     * @return array{version: string, updated: string}|null
     *   Associative array with at least a 'version' key, or null if the
     *   file is missing, unreadable, or contains invalid JSON.
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
}
