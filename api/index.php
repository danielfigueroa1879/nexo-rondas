<?php
// /api/index.php
require_once 'config/config.php';

$request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = explode('/', $request_uri);
// Expected path: /api/endpoint
// If deployed in a subdirectory, adjust the index.
$base_path_index = array_search('api', $uri);
if ($base_path_index === false) {
    http_response_code(404);
    echo json_encode(["message" => "Not found."]);
    exit();
}

$resource = isset($uri[$base_path_index + 1]) ? $uri[$base_path_index + 1] : null;
$action = isset($uri[$base_path_index + 2]) ? $uri[$base_path_index + 2] : null;

$method = $_SERVER['REQUEST_METHOD'];

// Get authorization token
$headers = apache_request_headers();
$token = null;
if (isset($headers['Authorization'])) {
    $matches = array();
    preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches);
    if (isset($matches[1])) {
        $token = $matches[1];
    }
}

// Read raw data
$data = json_decode(file_get_contents("php://input"));

// Routing
if ($resource === 'auth') {
    require_once 'controllers/AuthController.php';
    $authController = new AuthController();
    
    if ($method === 'POST' && $action === 'login') {
        $authController->login($data);
    } elseif ($method === 'GET' && $action === 'me') {
        if ($token) {
            $authController->me($token);
        } else {
            http_response_code(401);
            echo json_encode(["message" => "No token provided."]);
        }
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Endpoint not found."]);
    }
} elseif ($resource === 'admin') {
    // Check if token exists and user is admin (simplified for now)
    if (!$token) {
        http_response_code(401);
        echo json_encode(["message" => "Unauthorized."]);
        exit();
    }
    
    require_once 'controllers/AdminController.php';
    $adminController = new AdminController();
    
    if ($action === 'companies') {
        if ($method === 'GET') {
            $adminController->getCompanies();
        } elseif ($method === 'POST') {
            $adminController->createCompany($data);
        }
    } elseif ($action === 'facilities') {
        if ($method === 'GET' && isset($_GET['company_id'])) {
            $adminController->getFacilities($_GET['company_id']);
        } elseif ($method === 'POST') {
            $adminController->createFacility($data);
        }
    } elseif ($action === 'checkpoints') {
        if ($method === 'GET' && isset($_GET['facility_id'])) {
            $adminController->getCheckpoints($_GET['facility_id']);
        } elseif ($method === 'POST') {
            $adminController->createCheckpoint($data);
        }
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Admin endpoint not found."]);
    }
} else {
    http_response_code(404);
    echo json_encode(["message" => "Endpoint not found."]);
}
?>
