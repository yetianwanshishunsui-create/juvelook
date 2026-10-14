// 微信 JS-SDK：仅在微信内且服务端配置了公众号时启用扫一扫，否则由页面提供手动输入
import { portalApi } from './api.js';

const SDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
export const inWechat = () => /MicroMessenger/i.test(navigator.userAgent);

let ready = null;

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.wx) return resolve(window.wx);
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = () => resolve(window.wx);
    s.onerror = () => reject(new Error('微信 JS-SDK 加载失败'));
    document.head.appendChild(s);
  });
}

// 返回 true 表示扫一扫可用
export function initWechat() {
  if (!inWechat()) return Promise.resolve(false);
  ready ||= (async () => {
    // 签名 URL 必须是当前页面去掉 # 之后的部分
    const cfg = await portalApi.wxConfig(location.href.split('#')[0]);
    if (!cfg.enabled) return false;
    const wx = await loadScript();
    return new Promise((resolve) => {
      wx.config({ debug: false, ...cfg });
      wx.ready(() => resolve(true));
      wx.error(() => resolve(false));
    });
  })().catch(() => false);
  return ready;
}

export function wxScan() {
  return new Promise((resolve, reject) => {
    window.wx.scanQRCode({
      needResult: 1,
      scanType: ['qrCode', 'barCode'],
      success: (res) => resolve(String(res.resultStr || '').replace(/^[A-Z_0-9]+,/, '')), // 条码结果形如 "CODE_128,xxxx"
      cancel: () => reject(new Error('cancel')),
      fail: (e) => reject(new Error(e?.errMsg || '扫码失败')),
    });
  });
}
