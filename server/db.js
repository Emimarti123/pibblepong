import mysql from 'mysql2/promise';

// Pool de conexiones a MySQL; todas las fechas se manejan en UTC
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'pibblepong',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

// Cada conexión nueva usa UTC para que CURRENT_TIMESTAMP coincida con lo que lee mysql2
pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});
