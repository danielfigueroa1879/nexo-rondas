<?php
require_once '../api/config/Database.php';
require_once '../api/models/Company.php';
require_once '../api/models/Facility.php';
require_once '../api/models/Checkpoint.php';

class AdminController {
    private $db;
    private $company;
    private $facility;
    private $checkpoint;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->company = new Company($this->db);
        $this->facility = new Facility($this->db);
        $this->checkpoint = new Checkpoint($this->db);
    }

    // Company endpoints
    public function getCompanies() {
        $stmt = $this->company->readAll();
        http_response_code(200);
        echo json_encode($stmt);
    }

    public function createCompany($data) {
        if (!isset($data->rut) || !isset($data->name)) {
            http_response_code(400);
            echo json_encode(["message" => "RUT and name are required."]);
            return;
        }
        
        try {
            $id = $this->company->create($data);
            http_response_code(201);
            echo json_encode(["message" => "Company created.", "id" => $id]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error creating company.", "error" => $e->getMessage()]);
        }
    }

    // Facility endpoints
    public function getFacilities($company_id) {
        $stmt = $this->facility->readByCompany($company_id);
        http_response_code(200);
        echo json_encode($stmt);
    }

    public function createFacility($data) {
        if (!isset($data->company_id) || !isset($data->name)) {
            http_response_code(400);
            echo json_encode(["message" => "Company ID and name are required."]);
            return;
        }
        
        try {
            $id = $this->facility->create($data);
            http_response_code(201);
            echo json_encode(["message" => "Facility created.", "id" => $id]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error creating facility.", "error" => $e->getMessage()]);
        }
    }

    // Checkpoint endpoints
    public function getCheckpoints($facility_id) {
        $stmt = $this->checkpoint->readByFacility($facility_id);
        http_response_code(200);
        echo json_encode($stmt);
    }

    public function createCheckpoint($data) {
        if (!isset($data->facility_id) || !isset($data->name)) {
            http_response_code(400);
            echo json_encode(["message" => "Facility ID and name are required."]);
            return;
        }
        
        try {
            $result = $this->checkpoint->create($data);
            http_response_code(201);
            echo json_encode(["message" => "Checkpoint created.", "data" => $result]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error creating checkpoint.", "error" => $e->getMessage()]);
        }
    }
}
?>
