-- Esquema de la base de dades del qüestionari
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS preguntes (
  id INT NOT NULL AUTO_INCREMENT,
  pregunta VARCHAR(500) NOT NULL,
  imatge VARCHAR(500) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS respostes (
  id INT NOT NULL AUTO_INCREMENT,
  pregunta_id INT NOT NULL,
  resposta VARCHAR(255) NOT NULL,
  resCorrecta TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_respostes_pregunta FOREIGN KEY (pregunta_id)
    REFERENCES preguntes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
