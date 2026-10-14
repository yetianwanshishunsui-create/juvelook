// 一物一码验真：华熙（panpass）接口适配 + 本地模拟，由 VERIFY_MODE 切换
//
// 华熙测试接口：GET {VERIFY_URL}?code=&position=&mobileno=
// 返回 { code: "200" | "1001", msg, data: { product_name, batch_number, expiration_date, position, ... } }
// data.position：0 未窜货，1 窜货，2 未知

export class VerifyUnavailable extends Error {}

// 由产品名判断品类；客户若提供更可靠的字段（如编码段），在这里替换规则
export function classifyProduct(productName) {
  const n = String(productName || '').toLowerCase();
  if (n.includes('volume')) return 'black';
  if (n.includes('juvelook')) return 'blue';
  return null;
}

function normalize(body) {
  // 测试接口 code 为字符串 "200"，美团规范为整数 200，两种都接受
  if (Number(body?.code) !== 200 || !body.data) {
    return { ok: false, reason: body?.msg && body.msg !== 'Success' ? body.msg : '防伪码无法识别' };
  }
  const d = body.data;
  return {
    ok: true,
    productName: d.product_name || '',
    batchNumber: d.batch_number || '',
    expirationDate: d.expiration_date || '',
    queryCount: d.query_count ?? null,
    positionFlag: d.position != null ? String(d.position) : null,
    raw: body,
  };
}

function huaxiVerifier({ url, timeoutMs = 8000 }) {
  return async function verify({ code, position, mobile }) {
    const qs = new URLSearchParams({ code, position: position || '', mobileno: mobile || '' });
    let res;
    try {
      res = await fetch(`${url}?${qs}`, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new VerifyUnavailable(`验真服务连接失败：${err.message}`);
    }
    if (!res.ok) throw new VerifyUnavailable(`验真服务返回 HTTP ${res.status}`);
    let body;
    try {
      body = await res.json();
    } catch {
      throw new VerifyUnavailable('验真服务返回格式异常');
    }
    return normalize(body);
  };
}

// 模拟验真（开发 / 演示用），返回结构与华熙接口一致：
//   12–24 位数字；以 0000 结尾 → 1001 无法识别；以 9999 结尾 → 已过期；
//   末位奇数 → JUVELOOK，偶数 → JUVELOOK Volume；以 7 开头 → 窜货标记
function mockVerifier() {
  return async function verify({ code }) {
    if (!/^\d{12,24}$/.test(code) || code.endsWith('0000')) {
      return normalize({ code: '1001', msg: '防伪码无法识别' });
    }
    const volume = Number(code.at(-1)) % 2 === 0;
    return normalize({
      code: '200',
      msg: 'Success',
      data: {
        brand_name: 'juvelook',
        corporation_name: '华熙生物（模拟）',
        code,
        product_name: volume ? 'JUVELOOK Volume' : 'JUVELOOK',
        batch_number: `MOCK${code.slice(-6, -2)}`,
        production_date: '2026-03-01 00:00:00',
        expiration_date: code.endsWith('9999') ? '2025-03-01 00:00:00' : '2028-03-01 00:00:00',
        query_count: 1,
        position: code.startsWith('7') ? '1' : '0',
      },
    });
  };
}

export function createVerifier(cfg) {
  if (cfg.mode === 'huaxi') return huaxiVerifier({ url: cfg.url });
  return mockVerifier();
}
