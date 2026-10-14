// 微信公众号 JS-SDK 签名（医生端「扫一扫」需要）。未配置 WECHAT_APPID / WECHAT_SECRET 时不启用。
// access_token 与 jsapi_ticket 有效期 7200 秒，按微信要求在服务端缓存，提前 5 分钟刷新。
import { createHash, randomBytes } from 'node:crypto';

const API = 'https://api.weixin.qq.com/cgi-bin';

export function signJsapi({ ticket, url, nonceStr, timestamp }) {
  // 签名用的 URL 不含 # 及其后部分
  const clean = url.split('#')[0];
  const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${clean}`;
  return createHash('sha1').update(str).digest('hex');
}

export function createWechat({ appId, secret }) {
  if (!appId || !secret) return null;
  const cache = { token: null, ticket: null };

  async function getJson(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = await res.json();
    if (body.errcode) throw new Error(`微信接口错误 ${body.errcode}: ${body.errmsg}`);
    return body;
  }

  const fresh = (c) => c && c.expiresAt > Date.now();

  async function accessToken() {
    if (fresh(cache.token)) return cache.token.value;
    const b = await getJson(`${API}/token?grant_type=client_credential&appid=${appId}&secret=${secret}`);
    cache.token = { value: b.access_token, expiresAt: Date.now() + (b.expires_in - 300) * 1000 };
    return b.access_token;
  }

  async function ticket() {
    if (fresh(cache.ticket)) return cache.ticket.value;
    const b = await getJson(`${API}/ticket/getticket?access_token=${await accessToken()}&type=jsapi`);
    cache.ticket = { value: b.ticket, expiresAt: Date.now() + (b.expires_in - 300) * 1000 };
    return b.ticket;
  }

  return {
    appId,
    async jsapiConfig(url) {
      const nonceStr = randomBytes(8).toString('hex');
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signJsapi({ ticket: await ticket(), url, nonceStr, timestamp });
      return { appId, timestamp, nonceStr, signature, jsApiList: ['scanQRCode'] };
    },
  };
}
