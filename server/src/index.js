import { openDb } from './db.js';
import { createApp } from './app.js';
import { config } from './config.js';

const db = openDb(config.dbFile);
const app = createApp(db, config);

app.listen(config.port, () => {
  console.log(`juvelook server listening on http://localhost:${config.port}`);
  console.log(`  前台 H5   http://localhost:${config.port}/`);
  if (config.portalEnabled) console.log(`  医生端    http://localhost:${config.port}/#/portal`);
  console.log(`  运营后台  http://localhost:${config.port}/admin.html`);
  console.log(`database: ${config.dbFile} · verify: ${config.verify.mode} · portal: ${config.portalEnabled ? 'on' : 'off'} · wechat: ${config.wechat.appId ? 'on' : 'off'}`);
});
