require("dotenv").config();
const mysql = require("mysql2/promise");

// Connection pool to your RDS MySQL instance.
// dateStrings: true keeps timestamps as "YYYY-MM-DD HH:MM:SS" strings (matches what the frontend expects).
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

// Creates the schema if it doesn't exist yet. Safe to run on every boot.
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      full_name     VARCHAR(255) NOT NULL,
      username      VARCHAR(50)  NOT NULL UNIQUE,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url    VARCHAR(500) NULL,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      sender_id   INT NOT NULL,
      receiver_id INT NOT NULL,
      text        TEXT NOT NULL,
      delivered   TINYINT(1) NOT NULL DEFAULT 0,
      is_read     TINYINT(1) NOT NULL DEFAULT 0,
      created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_messages_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_messages_pair (sender_id, receiver_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = { pool, initDb };
