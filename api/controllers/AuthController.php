<?php
// /api/controllers/AuthController.php
require_once '../api/config/Database.php';
require_once '../api/models/User.php';
require_once '../api/utils/jwt.php';

class AuthController {
    private $db;
    private $user;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->user = new User($this->db);
    }

    public function login($data) {
        if (!isset($data->rut) || !isset($data->password)) {
            http_response_code(400);
            echo json_encode(["message" => "RUT and password are required."]);
            return;
        }

        $stmt = $this->user->findByRut($data->rut);
        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $id = $row['id'];
            $rut = $row['rut'];
            $name = $row['name'];
            $password_hash = $row['password_hash'];
            $role = $row['role'];
            $status = $row['status'];

            if ($status !== 'active') {
                http_response_code(401);
                echo json_encode(["message" => "Account is inactive."]);
                return;
            }

            if (password_verify($data->password, $password_hash)) {
                $payload = array(
                    "iat" => time(),
                    "exp" => time() + JWT_EXPIRATION,
                    "data" => array(
                        "id" => $id,
                        "rut" => $rut,
                        "name" => $name,
                        "role" => $role
                    )
                );

                $jwt = JWT::encode($payload, JWT_SECRET);
                http_response_code(200);
                echo json_encode(array(
                    "message" => "Successful login.",
                    "token" => $jwt,
                    "user" => $payload['data']
                ));
            } else {
                http_response_code(401);
                echo json_encode(["message" => "Invalid credentials."]);
            }
        } else {
            http_response_code(401);
            echo json_encode(["message" => "Invalid credentials."]);
        }
    }

    public function me($token) {
        $decoded = JWT::decode($token, JWT_SECRET);
        if ($decoded) {
            http_response_code(200);
            echo json_encode(["user" => $decoded->data]);
        } else {
            http_response_code(401);
            echo json_encode(["message" => "Invalid token."]);
        }
    }
}
?>
