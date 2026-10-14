import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));

export const config = {
  port: Number(process.env.PORT) || 3100,
  dbFile: process.env.DB_FILE || resolve(root, 'data/juvelook.db'),
  staticDir: process.env.STATIC_DIR || resolve(root, 'web/dist'),
};
