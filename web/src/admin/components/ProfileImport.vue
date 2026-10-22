<script setup>
import { ref, computed } from 'vue';
import { adminApi } from '../api.js';
import { toast } from '../store.js';
import Icon from '../../components/Icon.vue';

const file = ref(null);
const plan = ref(null);
const error = ref('');
const busy = ref(false);
const done = ref(null);
const input = ref(null);

async function pick(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) return (error.value = '文件不能超过 5MB');
  file.value = f;
  plan.value = null;
  done.value = null;
  error.value = '';
  busy.value = true;
  try {
    plan.value = await adminApi.importPreview(f);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

async function commit() {
  busy.value = true;
  error.value = '';
  try {
    const res = await adminApi.importCommit(file.value);
    done.value = res.summary;
    plan.value = null;
    file.value = null;
    toast.show('导入完成');
  } catch (err) {
    error.value = err.message;
    if (err.body?.summary) plan.value = err.body;
  } finally {
    busy.value = false;
  }
}

const S = computed(() => plan.value?.summary);
const nothing = computed(() => S.value && S.value.orgCreate + S.value.orgUpdate + S.value.doctorCreate + S.value.doctorUpdate === 0);
const ACT = { create: '新增', update: '更新' };
</script>

<template>

  <div class="steps">
    <section class="panel">
      <h2>① 下载模板</h2>
      <p class="p">模板含「机构」「医生」两个工作表和填写说明。先填机构，再填医生（医生的所属机构名称须与机构名称一致）。</p>
      <a v-if="adminApi.templateUrl" class="btn" :href="adminApi.templateUrl" download><Icon name="download" />下载 Excel 模板</a>
      <p v-else class="p" style="margin: 0">在线演示版不支持下载和上传文件，此功能在正式部署环境中可用。</p>
    </section>
    <section class="panel">
      <h2>② 上传并预览</h2>
      <p class="p">系统逐行校验、去重，并标出将新增或更新的记录。此时不会写入任何数据。</p>
      <input ref="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden @change="pick" />
      <button class="btn primary" type="button" :disabled="busy" @click="input.click()"><Icon name="upload" />{{ busy && !plan ? '解析中…' : '选择 Excel 文件' }}</button>
      <span v-if="file" class="fname">{{ file.name }}</span>
    </section>
  </div>

  <p v-if="error" class="err" role="alert">{{ error }}</p>

  <div v-if="done" class="panel ok-panel">
    <h2>导入完成</h2>
    <p class="p">新增机构 {{ done.orgCreate }} 家、更新机构 {{ done.orgUpdate }} 家；新增医生 {{ done.doctorCreate }} 位、更新医生 {{ done.doctorUpdate }} 位。</p>
    <RouterLink to="/doctors" class="btn">查看医生列表</RouterLink>
  </div>

  <template v-if="plan">
    <section class="panel summary">
      <h2>③ 确认导入</h2>
      <div class="sum">
        <div><b>{{ S.orgCreate }}</b>新增机构</div>
        <div><b>{{ S.orgUpdate }}</b>更新机构</div>
        <div><b>{{ S.doctorCreate }}</b>新增医生</div>
        <div><b>{{ S.doctorUpdate }}</b>更新医生</div>
        <div :class="{ bad: S.errorRows }"><b>{{ S.errorRows }}</b>错误行</div>
      </div>
      <p v-if="S.errorRows" class="err" style="margin: 12px 0 0">有 {{ S.errorRows }} 行未通过校验，请在 Excel 中修正后重新上传。全部通过后才能导入。</p>
      <p v-else-if="nothing" class="p" style="margin: 12px 0 0">文件中没有可导入的数据（示例行会被自动忽略）。</p>
      <div v-else style="margin-top: 14px">
        <button class="btn primary" type="button" :disabled="busy" @click="commit">{{ busy ? '导入中…' : '确认导入' }}</button>
      </div>
    </section>

    <h3 class="sec">机构（{{ plan.orgs.length }} 行）</h3>
    <div class="table-wrap">
      <table v-cards class="tbl">
        <thead><tr><th>行号</th><th>机构名称</th><th>城市</th><th>处理</th><th>问题</th></tr></thead>
        <tbody>
          <tr v-for="o in plan.orgs" :key="o.row">
            <td class="mono">{{ o.row }}</td>
            <td>{{ o.name || '—' }}</td>
            <td>{{ o.city || '—' }}</td>
            <td><span class="tag" :class="o.errors.length ? 'warn' : 'ok'">{{ o.errors.length ? '错误' : ACT[o.action] }}</span></td>
            <td class="errs">{{ o.errors.join('；') }}</td>
          </tr>
          <tr v-if="!plan.orgs.length"><td colspan="5" class="empty-row">无机构数据</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="sec">医生（{{ plan.doctors.length }} 行）</h3>
    <div class="table-wrap">
      <table v-cards class="tbl">
        <thead><tr><th>行号</th><th>医生姓名</th><th>所属机构</th><th>处理</th><th>问题</th></tr></thead>
        <tbody>
          <tr v-for="d in plan.doctors" :key="d.row">
            <td class="mono">{{ d.row }}</td>
            <td>{{ d.name || '—' }}</td>
            <td>{{ d.orgName || '—' }}</td>
            <td><span class="tag" :class="d.errors.length ? 'warn' : 'ok'">{{ d.errors.length ? '错误' : ACT[d.action] }}</span></td>
            <td class="errs">{{ d.errors.join('；') }}</td>
          </tr>
          <tr v-if="!plan.doctors.length"><td colspan="5" class="empty-row">无医生数据</td></tr>
        </tbody>
      </table>
    </div>
  </template>
</template>

<style scoped>
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
@media (max-width: 760px) { .steps { grid-template-columns: 1fr; } }
.p { color: var(--ink-soft); font-size: 13px; line-height: 1.7; margin: -4px 0 14px; }
.fname { margin-left: 10px; color: var(--ink-soft); font-size: 13px; }
.err { color: var(--danger); font-size: 13px; }
.ok-panel { border-color: var(--accent); margin-bottom: 16px; }
.summary { margin-bottom: 18px; }
.sum { display: flex; gap: 10px; flex-wrap: wrap; }
.sum div { background: var(--surface-2); border-radius: 10px; padding: 10px 16px; font-size: 12.5px; color: var(--ink-soft); display: flex; flex-direction: column; min-width: 96px; }
.sum b { font-size: 22px; color: var(--ink); font-variant-numeric: tabular-nums; }
.sum .bad b { color: var(--danger); }
.sec { font-size: 15px; margin: 20px 0 10px; }
.errs { color: var(--danger); font-size: 12.5px; }
</style>
