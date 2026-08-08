-- NEXO Rondas Database Schema

CREATE DATABASE IF NOT EXISTS nexo_rondas_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nexo_rondas_db;

-- Users table (Handles Login and Roles)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rut VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('superadmin', 'admin', 'supervisor', 'guard') NOT NULL DEFAULT 'guard',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Companies table (For Multi-tenant support)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rut VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Facilities (Instalaciones)
CREATE TABLE IF NOT EXISTS facilities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Checkpoints (Puntos de control QR/NFC)
CREATE TABLE IF NOT EXISTS checkpoints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    facility_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    unique_code VARCHAR(255) NOT NULL UNIQUE, -- QR or NFC Hash
    default_order INT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Routes (Rondas Configuradas)
CREATE TABLE IF NOT EXISTS routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    facility_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    schedule_time TIME NOT NULL, -- e.g. 23:00, 01:00
    tolerance_minutes INT DEFAULT 15,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Route Points (Secuencia estricta de la ronda)
CREATE TABLE IF NOT EXISTS route_points (
    route_id INT NOT NULL,
    checkpoint_id INT NOT NULL,
    sequence_order INT NOT NULL,
    PRIMARY KEY (route_id, checkpoint_id),
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
);

-- Round Executions (Historial de rondas realizadas)
CREATE TABLE IF NOT EXISTS round_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    guard_id INT NOT NULL,
    scheduled_datetime DATETIME NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    status ENUM('pending', 'in_progress', 'completed', 'incomplete', 'missed') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (guard_id) REFERENCES users(id)
);

-- Round Logs (Escaneos por punto)
CREATE TABLE IF NOT EXISTS round_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_execution_id INT NOT NULL,
    checkpoint_id INT NOT NULL,
    scanned_at DATETIME NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    time_since_last_scan_seconds INT, -- Duración entre puntos
    FOREIGN KEY (round_execution_id) REFERENCES round_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_execution_id INT,
    checkpoint_id INT,
    guard_id INT NOT NULL,
    description TEXT NOT NULL,
    photo_url VARCHAR(255),
    audio_url VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('open', 'resolved', 'ignored') DEFAULT 'open',
    FOREIGN KEY (round_execution_id) REFERENCES round_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id),
    FOREIGN KEY (guard_id) REFERENCES users(id)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert Default SuperAdmin (rut: 12345678-9, pass: admin123)
-- Hash generated using PHP password_hash('admin123', PASSWORD_DEFAULT)
INSERT INTO users (rut, name, password_hash, role) VALUES 
('12345678-9', 'Super Administrador', '$2y$10$w81.R0TfJ7s64t/yW.1/2e6i.R4H2c5Gv5zJ/Q7eG3lO2tKz/jHnC', 'superadmin');
