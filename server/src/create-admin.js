// 用法：npm run admin -- <用户名> [密码]   未给密码则随机生成。账号已存在时重置其密码。
import { openDb } from './db.js';
import { upsertAdmin } from './accounts.js';
import { config } from './config.js';

const [username, password] = process.argv.slice(2);
if (!username) {
  console.error('用法：npm run admin -- <用户名> [密码]');
  process.exit(1);
}
if (password && password.length < 8) {
  console.error('密码至少 8 位');
  process.exit(1);
}
const a = upsertAdmin(openDb(config.dbFile), { username, password });
console.log(`${a.created ? '已创建' : '已重置'}后台账号：${a.username} / ${a.password}`);
