<?php
// router.php - Used only for the PHP built-in server during development
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if (strpos($path, '/api') === 0) {
    // Route to API
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require 'api/index.php';
} else {
    // Route to public
    $file = __DIR__ . '/public' . $path;
    if ($path !== '/' && file_exists($file)) {
        return false; // serve the requested resource as-is.
    } else {
        require 'public/index.html';
    }
}
?>
