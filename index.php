<?php
/**
 * NanoCloud v2.0 - Root Redirector
 *
 * This file redirects requests to the public/ directory.
 * Allows v2.0 to work with existing web server configurations
 * that point to the root directory instead of public/.
 *
 * The version query string (?v=) is appended to the redirect target so that
 * the browser treats each new release as a distinct URL, preventing the
 * page itself from being served from cache after an update.
 */

// Read the current app version for cache-busting
require __DIR__ . '/src/version.php';

$versionData = get_current_version();
$version = $versionData['version'] ?? '0';

header('Location: public/index.php?v=' . urlencode($version));
exit;
