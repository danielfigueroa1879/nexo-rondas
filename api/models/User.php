<?php
// /api/models/User.php

class User {
    private $conn;
    private $table_name = "users";

    public $id;
    public $rut;
    public $name;
    public $password_hash;
    public $role;
    public $status;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function findByRut($rut) {
        $query = "SELECT id, rut, name, password_hash, role, status FROM " . $this->table_name . " WHERE rut = ? LIMIT 0,1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $rut);
        $stmt->execute();
        return $stmt;
    }
    
    public function findById($id) {
        $query = "SELECT id, rut, name, role, status FROM " . $this->table_name . " WHERE id = ? LIMIT 0,1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $id);
        $stmt->execute();
        return $stmt;
    }
}
?>
