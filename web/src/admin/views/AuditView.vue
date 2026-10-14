<script setup>
import { adminApi } from '../api.js';
import { useList } from '../useList.js';
import Pager from '../components/Pager.vue';

const { page, data, loading } = useList(adminApi.audit);
const ACTION = { create: '新增', update: '修改', delete: '删除', import: '批量导入', password: '修改密码' };
const ENTITY = { org: '机构', doctor: '医生', excel: 'Excel', admin: '账号' };

function describe(l) {
  let d = {};
  try {
    d = JSON.parse(l.detail || '{}') || {};
  } catch {
    // 忽略
  }
  if (l.action === 'import') return `新增机构 ${d.orgCreate}、更新机构 ${d.orgUpdate}、新增医生 ${d.doctorCreate}、更新医生 ${d.doctorUpdate}`;
  const parts = [d.name];
  if (d.countsBefore) parts.push(`支数 JUVELOOK ${d.countsBefore.blue}→${d.blue_count}，Volume ${d.countsBefore.black}→${d.black_count}`);
  if (d.status === 'revoked') parts.push('状态：已撤销');
  return parts.filter(Boolean).join('；');
}
</script>

<template>
  <div class="page-hd"><h1>操作日志</h1></div>
  <div class="table-wrap" :style="{ opacity: loading ? 0.6 : 1 }">
    <table class="tbl">
      <thead><tr><th>时间</th><th>账号</th><th>操作</th><th>对象</th><th>说明</th></tr></thead>
      <tbody>
        <tr v-for="l in data.items" :key="l.id">
          <td class="mono nowrap">{{ l.created_at }}</td>
          <td>{{ l.username || '—' }}</td>
          <td class="nowrap">{{ ACTION[l.action] || l.action }}</td>
          <td class="nowrap">{{ ENTITY[l.entity] || l.entity }}</td>
          <td>{{ describe(l) }}</td>
        </tr>
        <tr v-if="!data.items.length && !loading"><td colspan="5" class="empty-row">暂无操作记录</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :total="data.total" :page="data.page" :size="data.size" @go="page = $event" />
</template>
