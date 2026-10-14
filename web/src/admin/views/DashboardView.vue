<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminApi } from '../api.js';
import { PRODUCT } from '../../api.js';

const stats = ref(null);
const error = ref('');
onMounted(async () => {
  try {
    stats.value = await adminApi.stats();
  } catch (err) {
    error.value = err.message;
  }
});

const tiles = computed(() => {
  const t = stats.value?.totals;
  if (!t) return [];
  return [
    { label: '认证医生', value: t.doctors, unit: '位' },
    { label: '授权机构', value: t.orgs, unit: '家' },
    { label: 'JUVELOOK 累计', value: t.blue, unit: '支', kind: 'blue' },
    { label: 'JUVELOOK Volume 累计', value: t.black, unit: '支', kind: 'black' },
    { label: '今日核销', value: t.scans_today, unit: '支' },
    { label: '近 7 天核销', value: t.scans_7d, unit: '支' },
    { label: '窜货预警', value: t.diverted, unit: '条', warn: t.diverted > 0, to: '/scans?diverted=1' },
  ];
});

// 近 14 天，按日补齐空白天
const days = computed(() => {
  const rows = stats.value?.daily || [];
  const pad = (n) => String(n).padStart(2, '0');
  const out = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const get = (k) => rows.find((r) => r.day === key && r.kind === k)?.n || 0;
    out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, blue: get('blue'), black: get('black') });
  }
  return out;
});

// 图表几何：堆叠柱，2px 表面色间隙，顶端 4px 圆角
const W = 640, H = 220, PAD = { l: 34, r: 8, t: 12, b: 26 };
const chart = computed(() => {
  const max = Math.max(4, ...days.value.map((d) => d.blue + d.black));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const slot = plotW / days.value.length;
  const bw = Math.min(24, slot * 0.6);
  const y = (v) => PAD.t + plotH - (v / top) * plotH;
  const bars = days.value.map((d, i) => {
    const x = PAD.l + i * slot + (slot - bw) / 2;
    const yBlue = y(d.blue), yTotal = y(d.blue + d.black);
    return {
      ...d, x, cx: x + bw / 2,
      blueRect: d.blue ? { y: yBlue, h: y(0) - yBlue } : null,
      // 上段与下段之间留 2px 间隙
      blackRect: d.black ? { y: yTotal, h: Math.max(0, yBlue - yTotal - (d.blue ? 2 : 0)) } : null,
    };
  });
  const ticks = [0, 1, 2, 3, 4].map((k) => ({ v: k * step, y: y(k * step) }));
  return { bars, ticks, bw, slot, baseY: y(0) };
});

// 仅顶端圆角的矩形路径
function barPath(x, y, w, h, roundTop) {
  if (h <= 0) return '';
  const r = roundTop ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ''}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ''}V${y + h}Z`;
}

const hover = ref(null);
const totalRange = computed(() => days.value.reduce((s, d) => s + d.blue + d.black, 0));
</script>

<template>
  <div class="page-hd"><h1>数据概览</h1></div>

  <p v-if="error" style="color: var(--danger)">{{ error }}</p>

  <div v-if="stats" class="tiles">
    <component :is="t.to ? 'RouterLink' : 'div'" v-for="t in tiles" :key="t.label" :to="t.to" class="tile" :class="{ warn: t.warn }">
      <div class="t-lab"><span v-if="t.kind" class="cap" :class="t.kind"></span>{{ t.label }}</div>
      <div class="t-val">{{ t.value.toLocaleString() }}<span class="t-unit">{{ t.unit }}</span></div>
    </component>
  </div>

  <div v-if="stats" class="grid2">
    <section class="panel">
      <div class="ch-hd">
        <h2>近 14 天核销量</h2>
        <div class="legend">
          <span><i class="cap blue"></i>{{ PRODUCT.blue }}</span>
          <span><i class="cap black"></i>{{ PRODUCT.black }}</span>
        </div>
      </div>
      <p class="ch-sub">合计 {{ totalRange }} 支</p>
      <div class="ch-wrap" @mouseleave="hover = null">
        <svg :viewBox="`0 0 ${W} ${H}`" class="ch" role="img" :aria-label="`近 14 天核销量，合计 ${totalRange} 支`">
          <g class="grid">
            <template v-for="t in chart.ticks" :key="t.v">
              <line :x1="PAD.l" :x2="W - PAD.r" :y1="t.y" :y2="t.y" />
              <text :x="PAD.l - 8" :y="t.y + 4" text-anchor="end">{{ t.v }}</text>
            </template>
          </g>
          <g v-for="(b, i) in chart.bars" :key="b.key">
            <rect v-if="hover === i" class="hl" :x="PAD.l + i * chart.slot" :y="PAD.t" :width="chart.slot" :height="chart.baseY - PAD.t" />
            <path v-if="b.blueRect" class="m-blue" :d="barPath(b.x, b.blueRect.y, chart.bw, b.blueRect.h, !b.blackRect)" />
            <path v-if="b.blackRect" class="m-black" :d="barPath(b.x, b.blackRect.y, chart.bw, b.blackRect.h, true)" />
            <text v-if="i % 2 === 1 || i === 13" class="xl" :x="b.cx" :y="H - 8" text-anchor="middle">{{ b.label }}</text>
            <!-- 命中区域覆盖整列，大于柱子本身 -->
            <rect class="hit" :x="PAD.l + i * chart.slot" :y="PAD.t" :width="chart.slot" :height="chart.baseY - PAD.t" @mouseenter="hover = i" @click="hover = i" />
          </g>
        </svg>
        <div
          v-if="hover !== null"
          class="tip"
          :style="{ left: `${Math.min(88, Math.max(12, (chart.bars[hover].cx / W) * 100))}%` }"
        >
          <div class="tip-t">{{ chart.bars[hover].key }}</div>
          <div><i class="cap blue"></i>{{ PRODUCT.blue }}<b>{{ chart.bars[hover].blue }}</b></div>
          <div><i class="cap black"></i>{{ PRODUCT.black }}<b>{{ chart.bars[hover].black }}</b></div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>近 30 天核销 Top 5 医生</h2>
      <ol class="top">
        <li v-for="(d, i) in stats.topDoctors" :key="d.id">
          <span class="rk">{{ i + 1 }}</span>
          <div class="tm"><div class="tn">{{ d.name }}</div><div class="to">{{ d.org_name }}</div></div>
          <b>{{ d.n }} 支</b>
        </li>
        <li v-if="!stats.topDoctors.length" class="to">暂无核销</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tile { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; box-shadow: var(--shadow-soft); }
a.tile:hover { border-color: var(--line-strong); }
.t-lab { font-size: 12.5px; color: var(--ink-soft); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.t-val { font-size: 26px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
.t-unit { font-size: 12px; color: var(--ink-faint); font-weight: 500; margin-left: 3px; }
.tile.warn .t-val { color: var(--danger); }
.grid2 { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 1000px) { .grid2 { grid-template-columns: 1fr; } }

.ch-hd { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.ch-hd h2 { margin: 0; flex: 1; }
.ch-sub { font-size: 12.5px; color: var(--ink-faint); margin: 2px 0 8px; }
.legend { display: flex; gap: 14px; font-size: 12.5px; color: var(--ink-soft); }
.legend span, .tip div { display: inline-flex; align-items: center; gap: 6px; }
.legend .cap, .tip .cap { width: 8px; height: 11px; }
.ch-wrap { position: relative; }
.ch { width: 100%; height: auto; display: block; }
.grid line { stroke: var(--line); stroke-width: 1; }
.grid text, .xl { fill: var(--ink-faint); font-size: 11px; font-variant-numeric: tabular-nums; }
.m-blue { fill: var(--blue); }
.m-black { fill: var(--black); }
.hl { fill: var(--surface-2); }
.hit { fill: transparent; cursor: default; }
.tip {
  position: absolute; top: 0; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--line);
  border-radius: 10px; box-shadow: var(--shadow); padding: 8px 12px; font-size: 12.5px; pointer-events: none; white-space: nowrap;
  display: flex; flex-direction: column; gap: 3px; color: var(--ink-soft);
}
.tip-t { font-weight: 700; color: var(--ink); }
.tip b { color: var(--ink); margin-left: auto; padding-left: 14px; font-variant-numeric: tabular-nums; }
.top { list-style: none; margin: 0; padding: 0; }
.top li { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.top li:last-child { border-bottom: none; }
.rk { width: 22px; height: 22px; border-radius: 7px; background: var(--accent-wash); color: var(--accent-deep); display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: none; }
.tm { flex: 1; min-width: 0; }
.tn { font-weight: 600; }
.to { font-size: 12px; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top b { font-variant-numeric: tabular-nums; }
</style>
