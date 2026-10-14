import { openDb } from './db.js';
import { seedDemo } from './demo-data.js';
import { config } from './config.js';

const db = openDb(config.dbFile);
console.log(seedDemo(db) ? '已写入演示数据' : '数据库非空，跳过演示数据');
