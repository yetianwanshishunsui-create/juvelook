<script setup>
// 小程序扫码数据导入：上传 → 预览（可导入 / 跳过 / 问题行）→ 确认计入支数
import { ref, computed } from 'vue';
import { adminApi } from '../api.js';
import { toast } from '../store.js';
import Icon from '../../components/Icon.vue';

const file = ref(null);
const plan = ref(null);
const done = ref(null);
const error = ref('');
const busy = ref(false);
const input = ref(null);

function pick(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (f) preview(f);
}

// 测试版：生成一份与小程序导出格式相同的测试表直接预览，手机上也不用找文件
// 正式构建中 VITE_DEMO 为空，整段（含测试版模拟后端）被移除
const trySample = import.meta.env.VITE_DEMO
  ? async () => {
      const { buildSampleScanXlsx } = await import('../../demo/mock.js');
      const blob = await buildSampleScanXlsx();
      preview(new File([blob], '测试用扫码验真记录.xlsx'));
    }
  : null;

async function preview(f) {
  if (f.size > 5 * 1024 * 1024) return (error.value = '文件不能超过 5MB');
  file.value = f;
  plan.value = null;
  done.value = null;
  error.value = '';
  busy.value = true;
  try {
    plan.value = await adminApi.scanImportPreview(f);
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
    done.value = await adminApi.scanImportCommit(file.value);
    plan.value = null;
    toast.show(`已计入 ${done.value.summary.importable} 支`);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

const view = computed(() => done.value || plan.value);
const S = computed(() => view.value?.summary);
</script>

<template>
  <section class="panel">
    <h2>上传小程序导出的「扫码验真记录」</h2>
    <p class="p">
      直接上传小程序后台导出的表格，不需要改格式。系统只计入<b>医生身份</b>、验证结果为<b>正常</b>的扫码，
      按<b>产品标识</b>去重（同一支只算一次，重复导入也不会多算），按<b>手机号</b>对应到医生。
    </p>
    <input ref="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden @change="pick" />
    <button class="btn primary" type="button" :disabled="busy" @click="input.click()"><Icon name="upload" />{{ busy && !plan ? '读取中…' : '选择 Excel 文件' }}</button>
    <button v-if="trySample" class="btn" type="button" style="margin-left: 8px" :disabled="busy" @click="trySample">用测试数据试一下</button>
    <span v-if="file" class="fname">{{ file.name }}</span>
  </section>

  <p v-if="error" class="err" role="alert">{{ error }}</p>

  <template v-if="view">
    <section class="panel summary" :class="{ ok: done }">
      <h2>{{ done ? '导入完成' : '导入预览' }}</h2>
      <div class="sum">
        <div class="hl"><b>{{ S.importable }}</b>{{ done ? '已计入' : '可计入' }}（支）</div>
        <div><b>{{ S.blue }}</b>JUVELOOK</div>
        <div><b>{{ S.black }}</b>JUVELOOK Volume</div>
        <div><b>{{ S.doctorCount }}</b>涉及医生</div>
      </div>
      <p class="p skip">
        表格共 {{ S.totalRows }} 行。跳过：已计过的 {{ S.skippedDuplicate }} 行，非医生扫码 {{ S.skippedNotDoctor }} 行，验证结果异常 {{ S.skippedAbnormal }} 行。
        <template v-if="S.nameMismatch"><br /><span class="warn">有 {{ S.nameMismatch }} 位医生的表格姓名与系统不一致（见下方标注），请确认手机号是否对应正确再导入。</span></template>
        <template v-if="S.issueRows"><br /><span class="bad">需处理 {{ S.issueRows }} 行（见下方），这些行不会计入。</span>处理后重新导入同一份表格即可补上，已计过的不会重复。</template>
      </p>
      <div v-if="!done" class="acts">
        <button class="btn primary" type="button" :disabled="busy || !S.importable" @click="commit">{{ busy ? '导入中…' : `确认计入 ${S.importable} 支` }}</button>
        <span v-if="!S.importable" class="p" style="margin: 0">没有可计入的新数据</span>
      </div>
      <RouterLink v-else to="/scans?source=import" class="btn">查看导入的核销记录</RouterLink>
    </section>

    <template v-if="view.doctors.length">
      <h3 class="sec">按医生汇总（{{ view.doctors.length }} 位）</h3>
      <div class="table-wrap">
        <table v-cards class="tbl">
          <thead><tr><th>医生</th><th>认证编号</th><th>机构</th><th>手机号</th><th class="num">JUVELOOK</th><th class="num">Volume</th></tr></thead>
          <tbody>
            <tr v-for="d in view.doctors" :key="d.doctorId">
              <td><b>{{ d.name }}</b><div v-if="d.sheetNames.length" class="warn small">表格中姓名：{{ d.sheetNames.join('、') }}</div></td>
              <td class="mono">{{ d.code }}</td>
              <td>{{ d.org }}</td>
              <td class="mono">{{ d.phone }}</td>
              <td class="num">+{{ d.blue }}</td>
              <td class="num">+{{ d.black }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-if="view.issues.length">
      <h3 class="sec">需处理的行（{{ S.issueRows }}）</h3>
      <div class="table-wrap">
        <table v-cards class="tbl">
          <thead><tr><th>问题</th><th>表格行号</th><th>用户姓名</th><th>手机号</th><th>产品</th><th>验证时间</th></tr></thead>
          <tbody>
            <tr v-for="i in view.issues" :key="i.row">
              <td class="errs">{{ i.reason }}</td>
              <td class="mono">{{ i.row }}</td>
              <td>{{ i.name || '—' }}</td>
              <td class="mono">{{ i.phone || '—' }}</td>
              <td>{{ i.product || '—' }}</td>
              <td class="mono nowrap">{{ i.time || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="view.issuesTruncated" class="p">仅显示前 500 行问题。</p>
      <p class="p tip">常见处理：「系统中没有这个手机号的医生」→ 在「医生管理」中新增该医生或补填手机号；「未授权」→ 在「机构管理」中确认授权产品。</p>
    </template>
  </template>
</template>

<style scoped>
.p { color: var(--ink-soft); font-size: 13px; line-height: 1.7; margin: -4px 0 14px; }
.p b { color: var(--ink); }
.fname { margin-left: 10px; color: var(--ink-soft); font-size: 13px; overflow-wrap: anywhere; }
.err { color: var(--danger); font-size: 13px; }
.summary { margin: 16px 0 18px; }
.summary.ok { border-color: var(--accent); }
.sum { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.sum div { background: var(--surface-2); border-radius: 10px; padding: 10px 16px; font-size: 12.5px; color: var(--ink-soft); display: flex; flex-direction: column; min-width: 100px; }
.sum b { font-size: 22px; color: var(--ink); font-variant-numeric: tabular-nums; }
.sum .hl { background: var(--accent-wash); color: var(--accent-deep); }
.sum .hl b { color: var(--accent-deep); }
.skip { margin: 0 0 14px; }
.bad { color: var(--danger); font-weight: 600; }
.warn { color: var(--danger); }
.warn.small { font-size: 12px; font-weight: 600; margin-top: 2px; }
.acts { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sec { font-size: 15px; margin: 20px 0 10px; }
.errs { color: var(--danger); font-size: 12.5px; font-weight: 600; }
.tip { margin-top: 10px; }
</style>
