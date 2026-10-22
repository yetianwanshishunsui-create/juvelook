import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = process.env;

export const config = {
  port: Number(env.PORT) || 3100,
  dbFile: env.DB_FILE || resolve(root, 'data/juvelook.db'),
  staticDir: env.STATIC_DIR || resolve(root, 'web/dist'),
  // HTTPS 部署时设为 1，Cookie 加 Secure
  secureCookie: env.SECURE_COOKIE === '1',
  // 医生端扫码核销（默认关闭，医生扫码统一走客户小程序）
  portalEnabled: env.PORTAL_ENABLED === '1',
  verify: {
    mode: env.VERIFY_MODE === 'huaxi' ? 'huaxi' : 'mock',
    url: env.VERIFY_URL || 'http://huaxi.panpass.net/API/verification',
    // 联调用：允许核销过期产品 / 无法从产品名识别品类时按指定品类处理（blue | black）
    allowExpired: env.VERIFY_ALLOW_EXPIRED === '1',
    fallbackKind: ['blue', 'black'].includes(env.VERIFY_FALLBACK_KIND) ? env.VERIFY_FALLBACK_KIND : null,
  },
  wechat: { appId: env.WECHAT_APPID || '', secret: env.WECHAT_SECRET || '' },
};
