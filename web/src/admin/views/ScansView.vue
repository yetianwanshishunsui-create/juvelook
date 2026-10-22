<script setup>
import { useRoute } from 'vue-router';
import { adminApi } from '../api.js';
import { useList } from '../useList.js';
import Pager from '../components/Pager.vue';
import { PRODUCT } from '../../api.js';

const route = useRoute();
const { filters, page, data, loading } = useList(adminApi.scans, {
  q: '', kind: '', from: '', to: '', diverted: route.query.diverted === '1' ? '1' : '',
  source: ['h5', 'import'].includes(route.query.source) ? route.query.source : '',
});
</script>

<template>
  <div class="page-hd"><h1>核销记录</h1></div>

  <div class="toolbar">
    <input v-model="filters.q" class="input" placeholder="防伪码 / 医生 / 机构" />
    <select v-model="filters.kind" class="select">
      <option value="">全部产品</option>
      <option value="blue">JUVELOOK</option>
      <option value="black">JUVELOOK Volume</option>
    </select>
    <input v-model="filters.from" class="input" type="date" style="width: auto" aria-label="开始日期" />
    <span class="muted" style="color: var(--ink-faint)">至</span>
    <input v-model="filters.to" class="input" type="date" style="width: auto" aria-label="结束日期" />
    <select v-model="filters.source" class="select">
      <option value="">全部来源</option>
      <option value="import">小程序导入</option>
      <option value="h5">H5 扫码</option>
    </select>
    <label class="check"><input v-model="filters.diverted" type="checkbox" true-value="1" false-value="" />仅看窜货预警</label>
  </div>

  <div class="table-wrap" :style="{ opacity: loading ? 0.6 : 1 }">
    <table v-cards class="tbl">
      <thead>
        <tr><th>扫码时间</th><th>产品</th><th>防伪码 / 产品标识</th><th>批号</th><th>医生</th><th>机构</th><th>来源</th><th>验真提示</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in data.items" :key="s.id">
          <td class="mono nowrap">{{ s.created_at }}</td>
          <td><span class="tag" :class="s.kind">{{ PRODUCT[s.kind] }}</span></td>
          <td class="mono">{{ s.code }}</td>
          <td class="mono">{{ s.batch_number || '—' }}</td>
          <td class="nowrap">{{ s.doctor_name }}</td>
          <td>{{ s.org_name }}<span class="muted"> · {{ s.city }}</span></td>
          <td class="nowrap">{{ s.source === 'import' ? '小程序导入' : 'H5 扫码' }}</td>
          <td><span v-if="s.position_flag === '1'" class="tag warn">疑似窜货</span><span v-else class="muted">—</span></td>
        </tr>
        <tr v-if="!data.items.length && !loading"><td colspan="8" class="empty-row">没有符合条件的核销记录</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :total="data.total" :page="data.page" :size="data.size" @go="page = $event" />
</template>
