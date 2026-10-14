<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { adminApi } from '../api.js';
import { toast, confirmBox } from '../store.js';
import { useList } from '../useList.js';
import Icon from '../../components/Icon.vue';
import Modal from '../components/Modal.vue';
import Pager from '../components/Pager.vue';

const route = useRoute();
const orgs = ref([]);
const cities = computed(() => [...new Set(orgs.value.map((o) => o.city).filter(Boolean))]);
const { filters, page, data, loading, reload } = useList(adminApi.doctors, {
  q: '', city: '', orgId: String(route.query.orgId || ''), status: '',
});
const loadOrgs = async () => (orgs.value = await adminApi.orgOptions().catch(() => []));
onMounted(loadOrgs);

const editing = ref(null); // { id?, ...form }
const fieldErrors = ref({});
const saving = ref(false);
const orgOf = (id) => orgs.value.find((o) => o.id === id);
const formOrg = computed(() => editing.value && orgOf(editing.value.org_id));

function openForm(d) {
  fieldErrors.value = {};
  editing.value = d
    ? { id: d.id, name: d.name, org_id: d.org_id, mobile: d.mobile, code: d.code, blue_count: d.blue_count, black_count: d.black_count, status: d.status }
    : { name: '', org_id: filters.orgId || '', mobile: '', code: '', blue_count: 0, black_count: 0, status: 'active' };
}

async function save() {
  saving.value = true;
  fieldErrors.value = {};
  const { id, ...body } = editing.value;
  try {
    if (id) await adminApi.updateDoctor(id, body);
    else await adminApi.createDoctor(body);
    toast.show(id ? '已保存' : '已新增医生');
    editing.value = null;
    reload();
  } catch (err) {
    fieldErrors.value = err.body?.fields || {};
    if (!err.body?.fields) toast.show(err.message, 'err');
  } finally {
    saving.value = false;
  }
}

async function remove(d) {
  const ok = await confirmBox.ask({ title: '删除医生', text: `确定删除「${d.name}」？此操作不可撤销。`, okText: '删除', danger: true });
  if (!ok) return;
  try {
    await adminApi.deleteDoctor(d.id);
    toast.show('已删除');
    reload();
  } catch (err) {
    toast.show(err.message, 'err');
  }
}

const authed = (d, k) => (k === 'blue' ? d.auth_blue : d.auth_black);
</script>

<template>
  <div class="page-hd">
    <h1>医生管理</h1>
    <button class="btn primary" type="button" @click="openForm()"><Icon name="plus" />新增医生</button>
  </div>

  <div class="toolbar">
    <input v-model="filters.q" class="input" placeholder="姓名 / 认证编号 / 手机号" />
    <select v-model="filters.city" class="select">
      <option value="">全部城市</option>
      <option v-for="c in cities" :key="c">{{ c }}</option>
    </select>
    <select v-model="filters.orgId" class="select" style="max-width: 240px">
      <option value="">全部机构</option>
      <option v-for="o in orgs" :key="o.id" :value="o.id">{{ o.name }}</option>
    </select>
    <select v-model="filters.status" class="select">
      <option value="">全部状态</option>
      <option value="active">已认证</option>
      <option value="revoked">已撤销</option>
    </select>
  </div>

  <div class="table-wrap" :style="{ opacity: loading ? 0.6 : 1 }">
    <table class="tbl">
      <thead>
        <tr><th>医生</th><th>认证编号</th><th>所属机构</th><th>手机号</th><th class="num">JUVELOOK</th><th class="num">Volume</th><th class="num">扫码核销</th><th>状态</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="d in data.items" :key="d.id">
          <td class="nowrap"><b>{{ d.name }}</b></td>
          <td class="mono">{{ d.code }}</td>
          <td>{{ d.org_name }}<span class="muted"> · {{ d.city }}</span></td>
          <td class="mono">{{ d.mobile || '—' }}</td>
          <td class="num">{{ authed(d, 'blue') ? d.blue_count : '—' }}</td>
          <td class="num">{{ authed(d, 'black') ? d.black_count : '—' }}</td>
          <td class="num">{{ d.scan_count }}</td>
          <td><span class="tag" :class="d.status === 'active' ? 'ok' : 'off'">{{ d.status === 'active' ? '已认证' : '已撤销' }}</span></td>
          <td class="acts">
            <button class="btn sm link" type="button" @click="openForm(d)">编辑</button>
            <button class="btn sm link" style="color: var(--danger)" type="button" @click="remove(d)">删除</button>
          </td>
        </tr>
        <tr v-if="!data.items.length && !loading"><td colspan="9" class="empty-row">没有符合条件的医生</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :total="data.total" :page="data.page" :size="data.size" @go="page = $event" />

  <Modal v-if="editing" :title="editing.id ? '编辑医生' : '新增医生'" @close="editing = null">
    <form id="docForm" class="form-grid" @submit.prevent="save">
      <div class="f" :class="{ 'has-err': fieldErrors.name }">
        <label>医生姓名 *</label>
        <input v-model="editing.name" class="input" maxlength="20" />
        <div v-if="fieldErrors.name" class="ferr">{{ fieldErrors.name }}</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.org_id }">
        <label>所属机构 *</label>
        <select v-model="editing.org_id" class="select">
          <option value="" disabled>请选择</option>
          <option v-for="o in orgs" :key="o.id" :value="o.id">{{ o.city }} · {{ o.name }}</option>
        </select>
        <div v-if="fieldErrors.org_id" class="ferr">{{ fieldErrors.org_id }}</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.mobile }">
        <label>手机号</label>
        <input v-model="editing.mobile" class="input" inputmode="numeric" maxlength="11" />
        <div v-if="fieldErrors.mobile" class="ferr">{{ fieldErrors.mobile }}</div>
        <div v-else class="help">医生端登录使用（认证编号 + 手机号）</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.code }">
        <label>认证编号</label>
        <input v-model="editing.code" class="input" maxlength="32" placeholder="留空自动生成" />
        <div v-if="fieldErrors.code" class="ferr">{{ fieldErrors.code }}</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.blue_count }">
        <label>JUVELOOK 支数</label>
        <input v-model.number="editing.blue_count" class="input" type="number" min="0" :disabled="formOrg && !formOrg.auth_blue" />
        <div v-if="fieldErrors.blue_count" class="ferr">{{ fieldErrors.blue_count }}</div>
        <div v-else-if="formOrg && !formOrg.auth_blue" class="help">所属机构未授权该产品</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.black_count }">
        <label>JUVELOOK Volume 支数</label>
        <input v-model.number="editing.black_count" class="input" type="number" min="0" :disabled="formOrg && !formOrg.auth_black" />
        <div v-if="fieldErrors.black_count" class="ferr">{{ fieldErrors.black_count }}</div>
        <div v-else-if="formOrg && !formOrg.auth_black" class="help">所属机构未授权该产品</div>
      </div>
      <div class="f full">
        <label>认证状态</label>
        <div class="checks">
          <label class="check"><input v-model="editing.status" type="radio" value="active" />已认证</label>
          <label class="check"><input v-model="editing.status" type="radio" value="revoked" />已撤销（前台不再展示，医生端无法登录）</label>
        </div>
      </div>
      <p v-if="editing.id" class="help full" style="margin: 0; font-size: 12px; color: var(--ink-faint)">
        支数包含扫码核销的累计值，人工修改会记录到操作日志。
      </p>
    </form>
    <template #footer>
      <button class="btn" type="button" @click="editing = null">取消</button>
      <button class="btn primary" type="submit" form="docForm" :disabled="saving">保存</button>
    </template>
  </Modal>
</template>
