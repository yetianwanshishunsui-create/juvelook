import { openDb } from './db.js';
import { createApp } from './app.js';
import { config } from './config.js';

const db = openDb(config.dbFile);
const app = createApp(db, { staticDir: config.staticDir });

app.listen(config.port, () => {
  console.log(`juvelook server listening on http://localhost:${config.port}`);
  console.log(`database: ${config.dbFile}`);
});
