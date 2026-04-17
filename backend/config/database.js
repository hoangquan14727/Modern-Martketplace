const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'ecommerce.db');

let dbInstance;
const getDb = () => {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');
  }
  return dbInstance;
};

const testConnection = () => {
  try {
    const database = getDb();
    database.prepare('SELECT 1').get();
    console.log('SQLite Database connected successfully!');
    console.log('Database path:', dbPath);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

const isWriteStatement = (sql) => {
  const head = sql.trim().toUpperCase();
  return !head.startsWith('SELECT') && !head.startsWith('PRAGMA') && !head.startsWith('EXPLAIN');
};

const query = (sql, params = []) => {
  const database = getDb();
  const stmt = database.prepare(sql);
  if (isWriteStatement(sql)) {
    const result = stmt.run(...(params || []));
    return [{ insertId: result.lastInsertRowid, affectedRows: result.changes, changes: result.changes }];
  }
  return [stmt.all(...(params || []))];
};

const transaction = (fn) => {
  const database = getDb();
  return database.transaction(fn);
};

const getConnection = () => {
  const database = getDb();
  let inTx = false;
  const conn = {
    query: (sql, params) => query(sql, params),
    beginTransaction: () => {
      if (inTx) return;
      database.prepare('BEGIN IMMEDIATE').run();
      inTx = true;
    },
    commit: () => {
      if (!inTx) return;
      database.prepare('COMMIT').run();
      inTx = false;
    },
    rollback: () => {
      if (!inTx) return;
      try { database.prepare('ROLLBACK').run(); } catch (_) {}
      inTx = false;
    },
    release: () => {
      if (inTx) {
        try { database.prepare('ROLLBACK').run(); } catch (_) {}
        inTx = false;
      }
    }
  };
  return conn;
};

const db = getDb();
module.exports = db;
module.exports.getDb = getDb;
module.exports.testConnection = testConnection;
module.exports.query = query;
module.exports.transaction = transaction;
module.exports.getConnection = getConnection;
module.exports.pool = {
  query: (sql, params) => query(sql, params),
  getConnection: async () => getConnection()
};
