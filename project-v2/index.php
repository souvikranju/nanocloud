<?php
/**
 * NanoCloud v2.0 - Root Redirector
 * 
 * This file redirects requests to the public/ directory.
 * Allows v2.0 to work with existing web server configurations
 * that point to the root directory instead of public/.
 */

header('Location: public/index.php');
exit;
