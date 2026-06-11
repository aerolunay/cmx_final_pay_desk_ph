const mysql = require("mysql2/promise");
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";

const requiredEnv = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const poolConfig = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,

  /*
    Recommended:
    Set MYSQL_DATABASE in .env.

    Your queries currently use fully qualified schema names, so this is not
    strictly required, but setting it reduces ambiguity and supports safer
    least-privilege DB users.
  */
  database:
    process.env.MYSQL_DATABASE ||
    "2001_cmx_appdata_finalpay_database",

  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT || 0),

  connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT || 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  /*
    Prevent accidental multiple statements.
    This should remain false unless there is a very specific reason.
  */
  multipleStatements: false,

  /*
    Return DATE/DATETIME as strings to avoid timezone shifting in payroll data.
    This is usually safer for HR/payroll apps.
  */
  dateStrings: true,

  charset: "utf8mb4",
};

/*
  Optional SSL for production.

  Use:
  MYSQL_SSL=true

  If your MySQL server requires a CA cert, add:
  MYSQL_SSL_CA="-----BEGIN CERTIFICATE-----..."
*/
if (String(process.env.MYSQL_SSL || "").toLowerCase() === "true") {
  poolConfig.ssl = process.env.MYSQL_SSL_CA
    ? {
        ca: process.env.MYSQL_SSL_CA,
        rejectUnauthorized: true,
      }
    : {
        rejectUnauthorized: true,
      };
}

const pool = mysql.createPool(poolConfig);

async function testConnection() {
  let connection;

  try {
    connection = await pool.getConnection();

    if (NODE_ENV !== "test") {
      console.log("MySQL pool connected.");
    }
  } catch (err) {
    /*
      Log full details server-side only.
      Do not return these details in API responses.
    */
    console.error("MySQL connection failed:", {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      message: err.message,
    });

    if (NODE_ENV === "production") {
      /*
        Fail fast in production. Better to stop the app than run with
        broken DB connectivity.
      */
      process.exit(1);
    }
  } finally {
    if (connection) connection.release();
  }
}

testConnection();

module.exports = pool;