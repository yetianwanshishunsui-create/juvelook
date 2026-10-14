// 初始化：写入虚拟数据（仅库为空时）并确保存在后台管理员账号
import { openDb } from './db.js';
import { seedFakeData } from './fake-seed.js';
import { upsertAdmin } from './accounts.js';
import { config } from './config.js';

const db = openDb(config.dbFile);
const data = seedFakeData(db);
console.log(
  data
    ? `已写入虚拟数据：${data.orgs.length} 家机构、${data.doctors.length} 位医生、${data.scans.length} 条核销记录`
    : '数据库已有数据，跳过虚拟数据',
);

const username = process.env.ADMIN_USERNAME || 'admin';
if (!db.prepare('SELECT 1 FROM admins WHERE username = ?').get(username)) {
  const a = upsertAdmin(db, { username, password: process.env.ADMIN_PASSWORD, name: '管理员' });
  console.log(`已创建后台账号：${a.username} / ${a.password}（请登录后修改密码）`);
}
