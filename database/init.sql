CREATE TABLE IF NOT EXISTS veiculos (
    id INT NOT NULL AUTO_INCREMENT,
    placa VARCHAR(10) NOT NULL UNIQUE,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    ano INT NOT NULL,
    cor VARCHAR(50) NOT NULL,
    preco DECIMAL(10, 2) NOT NULL,
    status ENUM('DISPONIVEL', 'RESERVADO', 'VENDIDO') NOT NULL DEFAULT 'DISPONIVEL',
    -- Venda (saga) dona da reserva/venda; garante idempotência e impede que
    -- uma venda libere ou conclua a reserva de outra.
    venda_codigo VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

DROP PROCEDURE IF EXISTS migrate_veiculos_saga;
DELIMITER //
CREATE PROCEDURE migrate_veiculos_saga()
BEGIN
    DECLARE object_count INT DEFAULT 0;

    SELECT COUNT(*) INTO object_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'veiculos'
      AND COLUMN_NAME = 'venda_codigo';
    IF object_count = 0 THEN
        ALTER TABLE veiculos ADD COLUMN venda_codigo VARCHAR(20) NULL AFTER status;
    END IF;
END//
DELIMITER ;

CALL migrate_veiculos_saga();
DROP PROCEDURE migrate_veiculos_saga;
