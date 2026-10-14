<script setup>
import { api, PRODUCT, PRODUCT_SHORT } from '../api.js';
import { useDetail } from '../useDetail.js';
import Icon from '../components/Icon.vue';
import TopBar from '../components/TopBar.vue';
import VerifiedPill from '../components/VerifiedPill.vue';
import BottleStats from '../components/BottleStats.vue';
import StateBlock from '../components/StateBlock.vue';

const { data: o, error, loading, reload } = useDetail(api.org);
</script>

<template>
  <TopBar title="机构详情" />

  <div v-if="loading" class="skel tall" aria-busy="true"></div>

  <StateBlock v-else-if="error?.status === 404" icon="none" title="未找到该机构" text="该机构可能尚未授权或授权已失效" />
  <StateBlock v-else-if="error" icon="alert" title="加载失败" :text="error.message">
    <div class="chips"><button type="button" class="chip" @click="reload">重试</button></div>
  </StateBlock>

  <template v-else-if="o">
    <article class="card">
      <div class="dhero">
        <div class="dava"><Icon name="org" /></div>
        <div style="flex: 1; min-width: 0">
          <div class="dname">{{ o.name }} <VerifiedPill text="已授权" /></div>
          <div v-if="o.address || o.city" class="dmeta"><Icon name="pin" /><span>{{ o.address || o.city }}</span></div>
          <div v-if="o.code" class="dcode">授权编号 {{ o.code }}</div>
        </div>
      </div>

      <div class="sect-lab" style="margin-top: 0"><span>已授权产品</span></div>
      <div class="prodchips">
        <span v-for="p in o.products" :key="p" class="pchip" :class="p"><span class="cap" :class="p"></span>{{ PRODUCT[p] }}</span>
      </div>

      <div class="sect-lab" style="margin-top: 18px"><span>机构累计注射支数</span></div>
      <BottleStats :counts="o.totals" />

      <div class="sect-lab" style="margin-top: 18px"><span>机构认证医生</span><b>{{ o.doctors.length }} 位</b></div>
      <div class="memberlist">
        <RouterLink v-for="d in o.doctors" :key="d.id" :to="`/doctor/${d.id}`" class="mrow">
          <div class="mava">{{ d.name[0] }}</div>
          <div class="mname">{{ d.name }} <Icon name="check" class="tick" /></div>
          <div class="mcnt">
            <template v-for="(k, i) in o.products" :key="k">
              <template v-if="i"> · </template><span :class="k">{{ PRODUCT_SHORT[k] }} {{ d.counts[k].toLocaleString() }}</span>
            </template>
          </div>
          <Icon name="chev" class="chev" />
        </RouterLink>
        <p v-if="!o.doctors.length" class="empty">该机构暂无认证医生</p>
      </div>
    </article>
    <p class="foot">点击任一医生可查看其个人认证详情</p>
  </template>
</template>

<style scoped>
.prodchips { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 20px 4px; }
.pchip {
  display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600;
  padding: 6px 12px; border-radius: 10px; border: 1px solid var(--line);
}
.pchip.blue { background: var(--blue-wash); color: var(--blue); }
.pchip.black { background: var(--black-wash); color: var(--black); }

.memberlist { padding: 0 12px 10px; }
.mrow { display: flex; align-items: center; gap: 11px; padding: 11px 8px; border-radius: 12px; transition: .13s; }
.mrow:active { background: var(--surface-2); }
.mava {
  width: 36px; height: 36px; border-radius: 11px; flex: none; display: grid; place-items: center;
  background: var(--accent-wash); color: var(--accent-deep); font-weight: 700; font-size: 15px;
}
.mname { flex: 1; min-width: 0; font-weight: 600; font-size: 14.5px; display: flex; align-items: center; gap: 6px; }
.tick { width: 13px; height: 13px; color: var(--accent); }
.mcnt { font-size: 12px; color: var(--ink-soft); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mcnt .blue { color: var(--blue); font-weight: 700; }
.mcnt .black { color: var(--black); font-weight: 700; }
.empty { text-align: center; color: var(--ink-faint); font-size: 13.5px; padding: 18px 0 8px; margin: 0; }
</style>
