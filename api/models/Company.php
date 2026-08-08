<?php
// /api/models/Company.php

class Company {
    private $conn;
    private $table_name = "companies";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " (rut, name, contact_email, contact_phone) VALUES (?, ?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$data->rut, $data->name, $data->contact_email ?? null, $data->contact_phone ?? null]);
        return $this->conn->lastInsertId();
    }

    public function readAll() {
        $query = "SELECT * FROM " . $this->table_name . " WHERE status = 'active'";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>
