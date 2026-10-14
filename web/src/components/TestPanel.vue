<script setup>
// 测试版专用：悬浮「测试」按钮 + 面板（测试账号、一键登录、测试码规则、重置数据）。正式构建不包含此组件。
import { ref } from 'vue';
import { request } from '../api.js';
import { resetDemo, DEMO_ADMIN } from '../demo/mock.js';

defineProps({ lift: { type: Boolean, default: false } }); // 后台手机端有底部标签栏，按钮上移
const open = ref(false);
const busy = ref('');
const DOCTOR = { code: 'JVL-D0001', mobile: '13900000001' };

async function go(kind) {
  busy.value = kind;
  try {
    if (kind === 'doctor') {
      await request('POST', '/portal/login', { body: DOCTOR });
      // 可能已在 H5 页面内，只改 hash 不会重新加载，需显式刷新
      if (location.pathname.endsWith('admin.html')) location.assign('./#/portal');
      else {
        location.hash = '#/portal';
        location.reload();
      }
    } else {
      await request('POST', '/admin/login', { body: DEMO_ADMIN });
      if (location.pathname.endsWith('admin.html')) {
        location.hash = '#/';
        location.reload();
      } else location.assign('./admin.html#/');
    }
  } finally {
    busy.value = '';
  }
}

function reset() {
  resetDemo();
  location.reload();
}
</script>

<template>
  <button class="tp-fab" :class="{ lift }" type="button" aria-label="打开测试面板" @click="open = true">测试</button>
  <div v-if="open" class="tp-overlay" @click.self="open = false">
    <div class="tp-sheet" role="dialog" aria-modal="true" aria-labelledby="tp-title">
      <div class="tp-hd">
        <h2 id="tp-title">测试面板</h2>
        <button type="button" class="tp-x" aria-label="关闭" @click="open = false">✕</button>
      </div>
      <p class="tp-note">测试版：数据为程序生成的虚拟数据，只保存在本机浏览器；验真为模拟，正式版接入华熙验真接口与微信扫一扫。</p>

      <h3>入口</h3>
      <div class="tp-links">
        <a href="./#/">消费者查询</a>
        <a href="./#/portal">医生端</a>
        <a href="./admin.html#/">运营后台</a>
      </div>

      <h3>一键登录</h3>
      <div class="tp-grid">
        <button type="button" :disabled="!!busy" @click="go('doctor')">
          <b>医生端</b><span>编号 {{ DOCTOR.code }} · 手机 {{ DOCTOR.mobile }}</span>
        </button>
        <button type="button" :disabled="!!busy" @click="go('admin')">
          <b>运营后台</b><span>账号 {{ DEMO_ADMIN.username }} · 密码 {{ DEMO_ADMIN.password }}</span>
        </button>
      </div>
      <p class="tp-small">其他医生：第 n 位为编号 JVL-D000n、手机 1390000000n（如 JVL-D0012 / 13900000012）。</p>

      <h3>测试防伪码</h3>
      <ul class="tp-rules">
        <li><code>86173880123456789013</code> 末位奇数 → JUVELOOK</li>
        <li><code>86173880123456789012</code> 末位偶数 → JUVELOOK Volume</li>
        <li>以 <code>0000</code> 结尾 → 防伪码无法识别</li>
        <li>以 <code>9999</code> 结尾 → 产品已过期</li>
        <li>以 <code>7</code> 开头 → 验真平台提示窜货</li>
      </ul>
      <p class="tp-small">医生端「扫码核销」的输入框下有「填入测试码」，每次生成一个新码。</p>

      <button type="button" class="tp-reset" @click="reset">重置全部测试数据</button>
    </div>
  </div>
</template>

<style>
.tp-fab {
  position: fixed; z-index: 35; right: max(14px, env(safe-area-inset-right, 0px));
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--line); background: var(--surface); color: var(--accent-deep); font: inherit; font-size: 12.5px; font-weight: 700;
  padding: 7px 13px; border-radius: 20px; box-shadow: var(--shadow); cursor: pointer; opacity: .92;
}
/* 后台手机端：放进顶部品牌条右侧的空位，不遮挡列表 */
@media (max-width: 860px) { .tp-fab.lift { top: calc(9px + env(safe-area-inset-top, 0px)); bottom: auto; box-shadow: none; } }
.tp-overlay { position: fixed; inset: 0; z-index: 90; background: rgba(10, 16, 24, .45); display: flex; align-items: flex-end; justify-content: center; }
.tp-sheet {
  background: var(--surface); color: var(--ink); width: 100%; max-width: 480px; max-height: 88vh; overflow: auto;
  border-radius: 20px 20px 0 0; padding: 16px 18px calc(20px + env(safe-area-inset-bottom, 0px)); box-shadow: var(--shadow);
}
@media (min-width: 560px) { .tp-overlay { align-items: center; } .tp-sheet { border-radius: 20px; } }
.tp-hd { display: flex; align-items: center; }
.tp-hd h2 { flex: 1; margin: 0; font-size: 18px; }
.tp-x { border: none; background: var(--surface-2); color: var(--ink-soft); width: 30px; height: 30px; border-radius: 50%; cursor: pointer; }
.tp-sheet h3 { font-size: 13px; color: var(--ink-faint); margin: 16px 0 8px; font-weight: 600; }
.tp-note { font-size: 12.5px; color: var(--accent-deep); background: var(--accent-wash); border-radius: 10px; padding: 9px 12px; margin: 10px 0 0; line-height: 1.6; }
.tp-links { display: flex; gap: 8px; flex-wrap: wrap; }
.tp-links a { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; font-size: 14px; font-weight: 600; color: var(--accent-deep); text-decoration: none; }
.tp-grid { display: grid; gap: 8px; }
.tp-grid button {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; border: 1px solid var(--line);
  background: var(--surface-2); border-radius: 12px; padding: 10px 14px; font: inherit; color: var(--ink); cursor: pointer;
}
.tp-grid button b { font-size: 14.5px; }
.tp-grid button span { font-size: 12.5px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.tp-grid button:disabled { opacity: .6; }
.tp-small { font-size: 12px; color: var(--ink-faint); margin: 8px 0 0; line-height: 1.6; }
.tp-rules { margin: 0; padding-left: 1.1em; font-size: 13px; color: var(--ink-soft); display: grid; gap: 3px; }
.tp-rules code { font-variant-numeric: tabular-nums; color: var(--ink); font-family: inherit; font-weight: 600; overflow-wrap: anywhere; }
.tp-reset { margin-top: 18px; width: 100%; border: 1px solid var(--line); background: var(--surface); color: var(--danger); font: inherit; font-weight: 700; padding: 11px; border-radius: 12px; cursor: pointer; }
</style>
