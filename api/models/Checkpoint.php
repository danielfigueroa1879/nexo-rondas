<?php
// /api/models/Checkpoint.php

class Checkpoint {
    private $conn;
    private $table_name = "checkpoints";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " (facility_id, name, description, unique_code, default_order) VALUES (?, ?, ?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        // Generar un código único (hash) si no se provee
        $unique_code = $data->unique_code ?? bin2hex(random_bytes(16));
        $stmt->execute([
            $data->facility_id, 
            $data->name, 
            $data->description ?? null, 
            $unique_code, 
            $data->default_order ?? 0
        ]);
        return [
            "id" => $this->conn->lastInsertId(),
            "unique_code" => $unique_code
        ];
    }

    public function readByFacility($facility_id) {
        $query = "SELECT * FROM " . $this->table_name . " WHERE facility_id = ? AND status = 'active' ORDER BY default_order ASC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$facility_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>
