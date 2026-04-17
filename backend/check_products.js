const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'ecommerce.db');
const db = new Database(dbPath);

const row = db.prepare('SELECT COUNT(*) as count FROM products').get();
console.log('Total Products:', row.count);
const products = db.prepare('SELECT id, name FROM products LIMIT 5').all();
console.log('Sample Products:', products);
