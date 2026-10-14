<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api, PRODUCT_SHORT } from '../api.js';
import Icon from '../components/Icon.vue';
import VerifiedPill from '../components/VerifiedPill.vue';
import StateBlock from '../components/StateBlock.vue';

const mode = ref('doctor'); // doctor | org
const q = ref('');
const city = ref('');
const meta = ref(null);
const result = ref(null); // { items, truncated }
const loading = ref(false);
const error = ref('');

const isDoc = computed(() => mode.value === 'doctor');
const term = computed(() => q.value.trim());
const active = computed(() => (isDoc.value ? !!(term.value || city.value) : !!term.value));

onMounted(async () => {
  try {
    meta.value = await api.meta();
  } catch {
    // 统计信息只用于提示，失败不影响查询
  }
});

function setMode(m) {
  if (m === mode.value) return;
  mode.value = m;
  q.value = '';
  city.value = '';
}

// 输入防抖 + 取消过期请求，保证列表与输入框一致
let timer;
let ctrl;
watch([mode, term, city], () => {
  clearTimeout(timer);
  ctrl?.abort();
  error.value = '';
  if (!active.value) {
    result.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  timer = setTimeout(run, 250);
});

async function run() {
  ctrl = new AbortController();
  const { signal } = ctrl;
  try {
    const res = isDoc.value
      ? await api.searchDoctors(term.value, city.value, signal)
      : await api.searchOrgs(term.value, signal);
    if (signal.aborted) return;
    result.value = res;
  } catch (err) {
    if (err.name === 'AbortError') return;
    result.value = null;
    error.value = err.message;
  }
  loading.value = false;
}

// 关键词高亮：拆成片段渲染，避免 v-html 注入
function parts(text) {
  const t = term.value;
  const i = t ? text.indexOf(t) : -1;
  if (i < 0) return [{ s: text }];
  return [{ s: text.slice(0, i) }, { s: t, hit: true }, { s: text.slice(i + t.length) }];
}

const totalHint = computed(() => {
  if (!meta.value) return '';
  return isDoc.value ? `共收录 ${meta.value.doctorCount} 位认证医生` : `共收录 ${meta.value.orgCount} 家认证机构`;
});
const hotCities = computed(() => (meta.value?.cities || []).slice(0, 6));
const noneText = computed(() => {
  if (isDoc.value && !term.value) return { title: '该城市暂无认证医生', text: '换个城市或清除筛选试试' };
  const what = isDoc.value ? '医生' : '机构';
  return {
    title: `查询不到「${term.value}」`,
    text: `请核对${what}${isDoc.value ? '姓名' : '名称'}是否正确\n该${what}可能尚未通过 juvelook 认证`,
  };
});
</script>

<template>
  <div class="topbar home-top">
    <div class="brand-sm">juvelook<span class="reg">®</span></div>
    <span style="flex: 1"></span>
    <RouterLink to="/portal" class="portal-link"><Icon name="scan" class="ic-16" />医生入口</RouterLink>
  </div>

  <section class="hero">
    <div class="hero-eyebrow"><span class="hdot"></span>CERTIFIED · JUVELOOK</div>
    <h1 class="hero-h">每一份信任，<br />都有据可查。</h1>
    <p class="hero-sub">查验认证医生 · 认证机构 · JUVELOOK / JUVELOOK Volume 注射记录</p>
  </section>

  <div class="bar">
    <div class="seg" role="tablist">
      <button type="button" role="tab" :aria-selected="isDoc" :class="{ on: isDoc }" @click="setMode('doctor')">
        <Icon name="doc" class="ic-16" />认证医生
      </button>
      <button type="button" role="tab" :aria-selected="!isDoc" :class="{ on: !isDoc }" @click="setMode('org')">
        <Icon name="org" class="ic-16" />认证机构
      </button>
    </div>

    <form class="field" role="search" @submit.prevent="$event.target.querySelector('input').blur()">
      <Icon name="search" class="mag" />
      <input
        v-model="q"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        maxlength="40"
        :placeholder="isDoc ? '输入医生姓名或认证编号' : '输入机构名称或授权编号'"
        :aria-label="isDoc ? '医生姓名' : '机构名称'"
      />
      <button v-if="q" type="button" class="clear" aria-label="清除" @click="q = ''">✕</button>
    </form>

    <div v-if="isDoc" class="cityfilter">
      <Icon name="pin" class="cf-ic" />
      <select v-model="city" aria-label="按城市筛选">
        <option value="">全国城市</option>
        <option v-for="c in meta?.cities || []" :key="c" :value="c">{{ c }}</option>
      </select>
      <button v-if="city" type="button" class="cf-reset" @click="city = ''">重置</button>
    </div>

    <div class="hint">
      <span>{{ totalHint }}</span>
      <span v-if="active && result && !loading">匹配 {{ result.items.length }}{{ result.truncated ? '+' : '' }} {{ isDoc ? '位' : '家' }}</span>
    </div>
  </div>

  <!-- 初始引导 -->
  <StateBlock
    v-if="!active"
    icon="search"
    :title="isDoc ? '输入医生姓名或选择城市开始查询' : '输入机构名称开始查询'"
    :text="isDoc
      ? '查看医生认证状态、所在机构\n及 JUVELOOK / JUVELOOK Volume 累计注射支数'
      : '查看机构授权状态、认证医生\n及 JUVELOOK / JUVELOOK Volume 授权与累计支数'"
  >
    <div v-if="isDoc && hotCities.length" class="chips">
      <button v-for="c in hotCities" :key="c" type="button" class="chip" @click="city = c">{{ c }}</button>
    </div>
  </StateBlock>

  <div v-else-if="loading && !result" class="list" aria-busy="true">
    <div v-for="i in 3" :key="i" class="skel"></div>
  </div>

  <StateBlock v-else-if="error" icon="alert" title="查询失败" :text="error">
    <div class="chips"><button type="button" class="chip" @click="run">重试</button></div>
  </StateBlock>

  <StateBlock v-else-if="result && !result.items.length" icon="none" :title="noneText.title" :text="noneText.text" />

  <div v-else-if="result" class="list" :class="{ stale: loading }">
    <template v-if="isDoc">
      <RouterLink v-for="d in result.items" :key="d.id" :to="`/doctor/${d.id}`" class="rrow">
        <div class="avatar">{{ d.name[0] }}</div>
        <div class="rmain">
          <div class="rname">
            <span><template v-for="(p, i) in parts(d.name)" :key="i"><mark v-if="p.hit">{{ p.s }}</mark><template v-else>{{ p.s }}</template></template></span>
            <VerifiedPill />
          </div>
          <div class="rsub">{{ d.org.name }}{{ d.city ? ` · ${d.city}` : '' }}</div>
        </div>
        <div class="rcnt">
          <div v-for="k in ['blue', 'black']" :key="k" class="rc-line">
            <span class="cap" :class="k"></span>
            <b :class="k">{{ d.counts[k] === null ? '—' : d.counts[k].toLocaleString() }}</b>
          </div>
        </div>
        <Icon name="chev" class="chev" />
      </RouterLink>
    </template>
    <template v-else>
      <RouterLink v-for="o in result.items" :key="o.id" :to="`/org/${o.id}`" class="rrow">
        <div class="avatar"><Icon name="org" style="width: 21px; height: 21px" /></div>
        <div class="rmain">
          <div class="rname">
            <span><template v-for="(p, i) in parts(o.name)" :key="i"><mark v-if="p.hit">{{ p.s }}</mark><template v-else>{{ p.s }}</template></template></span>
            <VerifiedPill text="已授权" />
          </div>
          <div class="rsub">{{ o.city ? `${o.city} · ` : '' }}{{ o.address }}</div>
        </div>
        <div class="rcnt">
          {{ o.products.map((p) => PRODUCT_SHORT[p]).join(' / ') }}<br />{{ o.doctorCount }} 位医生
        </div>
        <Icon name="chev" class="chev" />
      </RouterLink>
    </template>
    <p v-if="result.truncated" class="foot">结果较多，仅显示前 {{ result.items.length }} 条，请输入更完整的名称</p>
  </div>

  <footer class="foot">
    认证信息由 juvelook 品牌方提供并维护<br />如有疑问请联系品牌官方客服
  </footer>
</template>

<style scoped>
.home-top { padding-top: 16px; }
.portal-link {
  display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--accent-deep);
  background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 6px 12px; box-shadow: var(--shadow-soft);
}

.hero {
  position: relative; overflow: hidden; border-radius: 20px; margin: 4px 0 2px; padding: 24px 22px 22px; color: #fff;
  background: linear-gradient(118deg, #0057B8 0%, #0057B8 52%, #0c1a2c 52%, #0a0e13 100%);
  box-shadow: var(--shadow);
}
.hero-eyebrow { display: flex; align-items: center; gap: 7px; font-size: 10.5px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; opacity: .92; }
.hdot { width: 6px; height: 6px; border-radius: 50%; background: #fff; }
.hero-h { font-weight: 700; font-size: 28px; line-height: 1.28; margin: 13px 0 11px; letter-spacing: .01em; }
.hero-sub { font-size: 12px; line-height: 1.6; opacity: .82; margin: 0; max-width: 25em; }

.bar { position: sticky; top: 0; z-index: 6; background: linear-gradient(var(--bg) 85%, transparent); padding: 12px 0; }
.seg {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: var(--surface-2);
  border: 1px solid var(--line); border-radius: 14px; padding: 4px; margin-bottom: 12px;
}
.seg button {
  border: none; background: transparent; cursor: pointer; font-size: 14.5px; font-weight: 600; color: var(--ink-soft);
  padding: 9px 0; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: .18s;
}
.seg button.on { background: var(--surface); color: var(--accent-deep); box-shadow: var(--shadow-soft); }

.field {
  display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1.5px solid var(--line);
  border-radius: 15px; padding: 12px 14px; box-shadow: var(--shadow-soft); transition: .18s; margin: 0;
}
.field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-wash); }
.mag { width: 19px; height: 19px; flex: none; color: var(--ink-faint); }
/* 16px 防止 iOS 聚焦时页面自动放大 */
.field input {
  border: none; outline: none; background: transparent; font-size: 16px; color: var(--ink);
  width: 100%; font-family: inherit; padding: 0; -webkit-appearance: none; appearance: none;
}
.field input::-webkit-search-cancel-button { display: none; }
.field input::placeholder { color: var(--ink-faint); }
.clear {
  border: none; background: var(--surface-2); color: var(--ink-soft); width: 22px; height: 22px; border-radius: 50%;
  flex: none; cursor: pointer; font-size: 12px; line-height: 1; display: grid; place-items: center; padding: 0;
}

.cityfilter {
  display: flex; align-items: center; gap: 6px; margin-top: 10px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 12px; padding: 3px 6px 3px 12px; box-shadow: var(--shadow-soft);
}
.cf-ic { width: 16px; height: 16px; color: var(--accent); }
.cityfilter select {
  flex: 1; border: none; background: transparent; color: var(--ink); font-family: inherit; font-size: 15px;
  font-weight: 600; padding: 9px 2px; outline: none; cursor: pointer; min-width: 0;
}
.cf-reset {
  border: none; background: var(--surface-2); color: var(--ink-soft); font-size: 12.5px; font-weight: 600;
  padding: 7px 12px; border-radius: 8px; cursor: pointer; flex: none;
}
.hint { font-size: 12.5px; color: var(--ink-faint); margin: 9px 4px 0; display: flex; justify-content: space-between; min-height: 20px; }

.list { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; transition: opacity .15s; }
.list.stale { opacity: .55; }

.rrow {
  display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--line);
  border-radius: 16px; box-shadow: var(--shadow-soft); padding: 14px; transition: .15s; animation: rise .28s ease both;
}
.rrow:active { border-color: var(--line-strong); transform: scale(.99); }
.avatar {
  width: 44px; height: 44px; border-radius: 13px; flex: none; display: grid; place-items: center;
  font-weight: 700; font-size: 18px; background: var(--accent-wash); color: var(--accent-deep);
}
.rmain { flex: 1; min-width: 0; }
.rname { font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; overflow-wrap: anywhere; }
.rsub { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rcnt { font-size: 12px; color: var(--ink-faint); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rc-line { display: flex; align-items: center; justify-content: flex-end; gap: 6px; line-height: 1.6; }
.rc-line .cap { width: 7px; height: 10px; }
.rc-line b.blue { color: var(--blue); }
.rc-line b.black { color: var(--black); }
</style>
