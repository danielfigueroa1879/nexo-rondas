<?php
// /api/models/Facility.php

class Facility {
    private $conn;
    private $table_name = "facilities";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " (company_id, name, address) VALUES (?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$data->company_id, $data->name, $data->address ?? null]);
        return $this->conn->lastInsertId();
    }

    public function readByCompany($company_id) {
        $query = "SELECT * FROM " . $this->table_name . " WHERE company_id = ? AND status = 'active'";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$company_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>
