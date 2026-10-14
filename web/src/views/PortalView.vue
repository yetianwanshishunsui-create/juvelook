<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { portalApi, PRODUCT, IS_DEMO } from '../api.js';
import { initWechat, wxScan, inWechat } from '../wx.js';
import Icon from '../components/Icon.vue';
import VerifiedPill from '../components/VerifiedPill.vue';
import StateBlock from '../components/StateBlock.vue';

const router = useRouter();
const phase = ref('loading'); // loading | login | work | error
const me = ref(null);
const records = ref([]);
const loadError = ref('');

// 登录
const form = ref({ code: '', mobile: '' });
const loginErr = ref('');
const loggingIn = ref(false);

// 扫码
const wxReady = ref(false);
const sheet = ref(null); // null | 'input' | 'result'
const manualCode = ref('');
const scanning = ref(false);
const result = ref(null); // { ok, ...data } | { ok:false, error }

async function loadWorkspace() {
  const [m, s] = await Promise.all([portalApi.me(), portalApi.scans()]);
  me.value = m;
  records.value = s;
  phase.value = 'work';
}

onMounted(async () => {
  try {
    await loadWorkspace();
    wxReady.value = await initWechat();
  } catch (err) {
    if (err.status === 401) phase.value = 'login';
    else {
      loadError.value = err.message;
      phase.value = 'error';
    }
  }
});

async function login() {
  loginErr.value = '';
  if (!form.value.code.trim() || !form.value.mobile.trim()) {
    loginErr.value = '请填写认证编号和手机号';
    return;
  }
  loggingIn.value = true;
  try {
    await portalApi.login(form.value.code, form.value.mobile);
    await loadWorkspace();
    wxReady.value = await initWechat();
  } catch (err) {
    loginErr.value = err.message;
  } finally {
    loggingIn.value = false;
  }
}

async function logout() {
  await portalApi.logout().catch(() => {});
  me.value = null;
  form.value = { code: '', mobile: '' };
  phase.value = 'login';
}

async function startScan() {
  if (wxReady.value) {
    try {
      await submit(await wxScan());
    } catch (err) {
      if (err.message !== 'cancel') showResult({ ok: false, error: err.message });
    }
    return;
  }
  manualCode.value = '';
  sheet.value = 'input';
}

async function submit(code) {
  if (!String(code || '').trim()) return;
  scanning.value = true;
  try {
    const out = await portalApi.scan(code);
    me.value.counts = {
      blue: me.value.counts.blue === null ? null : out.counts.blue,
      black: me.value.counts.black === null ? null : out.counts.black,
    };
    me.value.scanTotal++;
    records.value = await portalApi.scans();
    showResult({ ok: true, ...out });
  } catch (err) {
    if (err.status === 401) return logout();
    showResult({ ok: false, error: err.message, status: err.status });
  } finally {
    scanning.value = false;
  }
}

function showResult(r) {
  result.value = r;
  sheet.value = 'result';
}

const fmtTime = (s) => String(s).slice(5, 16);
const statKinds = ['blue', 'black'];
const hint = computed(() =>
  wxReady.value
    ? '点击后调起微信扫一扫，对准产品上的防伪码'
    : inWechat()
      ? '公众号扫码能力未配置，请手动输入防伪码'
      : '请在微信内打开以使用扫一扫；当前可手动输入防伪码',
);
</script>

<template>
  <div class="topbar">
    <button class="tb-btn" type="button" aria-label="首页" @click="router.push('/')"><Icon name="home" /></button>
    <span class="tb-title">{{ phase === 'work' ? '医生工作台' : '医生登录' }}</span>
    <button v-if="phase === 'work'" class="tb-btn" type="button" aria-label="退出登录" @click="logout"><Icon name="logout" /></button>
    <span v-else style="width: 38px"></span>
  </div>

  <div v-if="phase === 'loading'" class="skel tall" aria-busy="true"></div>

  <StateBlock v-else-if="phase === 'error'" icon="alert" title="加载失败" :text="loadError">
    <div class="chips"><button type="button" class="chip" @click="$router.go(0)">重试</button></div>
  </StateBlock>

  <!-- 登录 -->
  <section v-else-if="phase === 'login'" class="login">
    <div class="login-hd">
      <Icon name="badge" class="login-ic" />
      <div>
        <div class="login-t">认证医生登录</div>
        <div class="login-s">登录后扫码核销，支数自动累加到本人名下</div>
      </div>
    </div>
    <form class="dp-card" @submit.prevent="login">
      <label class="fld">
        <span>认证编号</span>
        <input v-model="form.code" autocomplete="username" autocapitalize="characters" placeholder="如 JVL-D0001" maxlength="32" />
      </label>
      <label class="fld">
        <span>手机号</span>
        <input v-model="form.mobile" type="tel" inputmode="numeric" autocomplete="tel" placeholder="登记的 11 位手机号" maxlength="13" />
      </label>
      <p v-if="loginErr" class="err" role="alert">{{ loginErr }}</p>
      <button class="primary" type="submit" :disabled="loggingIn">{{ loggingIn ? '登录中…' : '登录' }}</button>
    </form>
    <p v-if="IS_DEMO" class="demo-hint">演示账号：认证编号 <b>JVL-D0001</b> · 手机号 <b>13900000001</b>
      <button type="button" class="fill" @click="form = { code: 'JVL-D0001', mobile: '13900000001' }">一键填入</button></p>
    <p class="foot">认证编号与手机号由品牌方登记；如无法登录请联系品牌方运营人员</p>
  </section>

  <!-- 工作台 -->
  <template v-else-if="phase === 'work' && me">
    <article class="dp-card">
      <div class="dp-doc">
        <div class="dava">{{ me.name[0] }}</div>
        <div style="flex: 1; min-width: 0">
          <div class="dname">{{ me.name }} <VerifiedPill /></div>
          <div class="dmeta"><Icon name="org" /><span>{{ me.org.name }}{{ me.org.city ? ` · ${me.org.city}` : '' }}</span></div>
          <div class="dcode">认证编号 {{ me.code }}</div>
        </div>
      </div>
      <div class="dp-stats">
        <div v-for="k in statKinds" :key="k" class="dp-stat" :class="k">
          <div class="lab"><span class="cap" :class="k"></span>{{ PRODUCT[k] }}</div>
          <div v-if="me.counts[k] === null" class="na">未授权</div>
          <div v-else class="num">{{ me.counts[k].toLocaleString() }}<span class="unit">支</span></div>
        </div>
      </div>
      <button class="scan-btn" type="button" :disabled="scanning" @click="startScan">
        <Icon name="scan" style="width: 20px; height: 20px" />{{ scanning ? '核销中…' : '扫码核销' }}
      </button>
      <p class="scan-hint">{{ hint }}</p>
      <p v-if="IS_DEMO" class="demo-hint">演示防伪码：<b>86173880123456789013</b>（JUVELOOK）、<b>86173880123456789012</b>（Volume）；末位改其他数字可生成新码；以 0000 结尾为无法识别，以 7 开头为窜货。</p>
    </article>

    <div class="sect-lab rec-lab"><span>我的核销记录</span><b>共 {{ me.scanTotal }} 条</b></div>
    <div class="rec-list">
      <div v-for="s in records" :key="s.code" class="rec-row">
        <span class="cap" :class="s.kind"></span>
        <div class="rec-main">
          <div class="rec-t">{{ PRODUCT[s.kind] }} · +1 支<span v-if="s.position_flag === '1'" class="warn-tag">窜货预警</span></div>
          <div class="rec-code">{{ s.code }}</div>
        </div>
        <div class="rec-time">{{ fmtTime(s.created_at) }}</div>
      </div>
      <p v-if="!records.length" class="empty">暂无核销记录，点击上方「扫码核销」开始</p>
      <p v-else-if="me.scanTotal > records.length" class="empty">仅显示最近 {{ records.length }} 条</p>
    </div>
  </template>

  <!-- 底部弹层：手动输入 / 核销结果 -->
  <div v-if="sheet" class="overlay" @click.self="sheet = null">
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="grab"></div>
      <template v-if="sheet === 'input'">
        <h2>输入防伪码</h2>
        <p class="sh-sub">输入产品上的一物一码防伪码（数字）</p>
        <form @submit.prevent="submit(manualCode)">
          <label class="fld">
            <span>防伪码</span>
            <input v-model="manualCode" inputmode="numeric" autocomplete="off" placeholder="如 86173880000053324957" maxlength="64" autofocus />
          </label>
          <div class="sheet-actions">
            <button type="button" class="ghost" @click="sheet = null">取消</button>
            <button type="submit" class="primary" :disabled="scanning || !manualCode.trim()">{{ scanning ? '核销中…' : '验真并核销' }}</button>
          </div>
        </form>
      </template>
      <template v-else-if="result">
        <div class="res" :class="result.ok ? 'ok' : 'fail'">
          <div class="res-ic"><Icon :name="result.ok ? 'check' : 'alert'" /></div>
          <h2>{{ result.ok ? '核销成功' : '核销未成功' }}</h2>
          <template v-if="result.ok">
            <p class="res-main"><span class="cap" :class="result.kind"></span>{{ result.product }} <b>+1 支</b></p>
            <p class="res-sub">防伪码 {{ result.code }}<template v-if="result.batchNumber"> · 批号 {{ result.batchNumber }}</template></p>
            <p v-if="result.diverted" class="res-warn">验真平台提示该产品疑似窜货，已记录，品牌方可在后台核查</p>
          </template>
          <p v-else class="res-sub">{{ result.error }}</p>
        </div>
        <div class="sheet-actions">
          <button type="button" class="ghost" @click="sheet = null">完成</button>
          <button type="button" class="primary" @click="startScan">继续扫码</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-hd { display: flex; align-items: center; gap: 12px; margin: 10px 2px 16px; }
.login-ic { width: 32px; height: 32px; color: var(--accent); }
.login-t { font-weight: 700; font-size: 18px; }
.login-s { font-size: 12.5px; color: var(--ink-soft); }

.dp-card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 18px; animation: rise .3s ease both; }
.dp-doc { display: flex; gap: 13px; align-items: flex-start; }
.dp-doc .dava { width: 52px; height: 52px; font-size: 22px; border-radius: 15px; }
.dp-doc .dname { font-size: 20px; }
.dp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
.dp-stat { background: var(--surface-2); border: 1px solid var(--line); border-radius: 14px; padding: 13px 14px; min-width: 0; }
.dp-stat .lab { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-soft); font-weight: 600; white-space: nowrap; }
.dp-stat .num { font-weight: 700; font-size: 26px; margin-top: 6px; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 4px; }
.dp-stat.blue .num { color: var(--blue); }
.dp-stat.black .num { color: var(--black); }
.dp-stat .unit { font-size: 12px; font-weight: 500; color: var(--ink-faint); }
.dp-stat .na { color: var(--ink-faint); font-size: 14px; margin-top: 9px; }

.scan-btn, .primary {
  width: 100%; border: none; border-radius: 14px; background: var(--accent); color: #fff; font-size: 16px; font-weight: 700;
  padding: 15px; display: flex; align-items: center; justify-content: center; gap: 9px; cursor: pointer; box-shadow: var(--shadow-soft);
}
.scan-btn:active, .primary:active { background: var(--accent-deep); }
.scan-btn:disabled, .primary:disabled { opacity: .6; }
.ghost {
  width: 100%; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink);
  font-size: 15px; font-weight: 600; padding: 14px; cursor: pointer;
}
.scan-hint { font-size: 12px; color: var(--ink-faint); text-align: center; margin: 10px 0 0; }

.fld { display: block; margin-bottom: 14px; }
.fld span { display: block; font-size: 13px; font-weight: 600; color: var(--ink-soft); margin-bottom: 7px; }
.fld input {
  width: 100%; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 12px;
  padding: 12px 13px; font-size: 16px; font-family: inherit; outline: none;
}
.fld input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }
.demo-hint { font-size: 12.5px; line-height: 1.7; color: var(--accent-deep); background: var(--accent-wash); border-radius: 12px; padding: 10px 12px; margin: 14px 0 0; overflow-wrap: anywhere; }
.fill { margin-left: 6px; border: none; background: var(--accent); color: #fff; border-radius: 8px; padding: 3px 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
.err { color: var(--danger); font-size: 13px; margin: -4px 0 12px; }

.rec-lab { padding: 0 4px; margin-top: 22px; }
.rec-list { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 4px 14px; }
.rec-row { display: flex; align-items: center; gap: 11px; padding: 11px 0; border-bottom: 1px dashed var(--line); }
.rec-row:last-of-type { border-bottom: none; }
.rec-main { flex: 1; min-width: 0; }
.rec-t { font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.rec-code { font-size: 11.5px; color: var(--ink-faint); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.rec-time { font-size: 11.5px; color: var(--ink-faint); white-space: nowrap; }
.warn-tag { font-size: 10.5px; font-weight: 700; color: var(--danger); background: var(--danger-wash); padding: 1px 6px; border-radius: 6px; }
.empty { text-align: center; color: var(--ink-faint); font-size: 13px; padding: 14px 0; margin: 0; }

.overlay { position: fixed; inset: 0; background: rgba(10, 16, 24, .45); display: flex; align-items: flex-end; justify-content: center; z-index: 40; animation: fade .18s ease; }
.sheet {
  background: var(--surface); width: 100%; max-width: 440px; border-radius: 22px 22px 0 0; box-shadow: var(--shadow);
  padding: 8px 20px calc(22px + env(safe-area-inset-bottom)); max-height: 92vh; overflow: auto; animation: slideup .26s cubic-bezier(.2, .8, .25, 1);
}
.grab { width: 38px; height: 4px; border-radius: 3px; background: var(--line-strong); margin: 6px auto 14px; }
.sheet h2 { font-weight: 700; font-size: 19px; margin: 0 0 4px; }
.sh-sub { font-size: 12.5px; color: var(--ink-faint); margin: 0 0 16px; }
.sheet-actions { display: flex; gap: 10px; margin-top: 18px; }
.res { text-align: center; padding: 8px 0 4px; }
.res-ic { width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 12px; display: grid; place-items: center; }
.res-ic .icon { width: 28px; height: 28px; }
.res.ok .res-ic { background: var(--accent-wash); color: var(--accent); }
.res.fail .res-ic { background: var(--danger-wash); color: var(--danger); }
.res-main { font-size: 17px; font-weight: 600; margin: 10px 0 4px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.res-main b { color: var(--accent); }
.res-sub { font-size: 13px; color: var(--ink-soft); margin: 4px 0; overflow-wrap: anywhere; }
.res-warn { font-size: 12.5px; color: var(--danger); background: var(--danger-wash); border-radius: 10px; padding: 9px 12px; margin: 12px 0 0; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideup { from { transform: translateY(30px); } to { transform: none; } }
@media (min-width: 520px) { .overlay { align-items: center; } .sheet { border-radius: 22px; } }
</style>
