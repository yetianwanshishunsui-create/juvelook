<script setup>
import { ref } from 'vue';
import { adminApi } from '../api.js';
import { toast, confirmBox } from '../store.js';
import { useList } from '../useList.js';
import Icon from '../../components/Icon.vue';
import Modal from '../components/Modal.vue';
import Pager from '../components/Pager.vue';

const { filters, page, data, loading, reload } = useList(adminApi.orgs, { q: '', city: '', status: '' });

const editing = ref(null);
const fieldErrors = ref({});
const saving = ref(false);

function openForm(o) {
  fieldErrors.value = {};
  editing.value = o
    ? { id: o.id, name: o.name, city: o.city, address: o.address, code: o.code, auth_blue: !!o.auth_blue, auth_black: !!o.auth_black, status: o.status }
    : { name: '', city: '', address: '', code: '', auth_blue: true, auth_black: false, status: 'active' };
}

async function save() {
  saving.value = true;
  fieldErrors.value = {};
  const { id, ...body } = editing.value;
  try {
    if (id) await adminApi.updateOrg(id, body);
    else await adminApi.createOrg(body);
    toast.show(id ? '已保存' : '已新增机构');
    editing.value = null;
    reload();
  } catch (err) {
    fieldErrors.value = err.body?.fields || {};
    if (!err.body?.fields) toast.show(err.message, 'err');
  } finally {
    saving.value = false;
  }
}

async function remove(o) {
  const ok = await confirmBox.ask({ title: '删除机构', text: `确定删除「${o.name}」？此操作不可撤销。`, okText: '删除', danger: true });
  if (!ok) return;
  try {
    await adminApi.deleteOrg(o.id);
    toast.show('已删除');
    reload();
  } catch (err) {
    toast.show(err.message, 'err');
  }
}
</script>

<template>
  <div class="page-hd">
    <h1>机构管理</h1>
    <button class="btn primary" type="button" @click="openForm()"><Icon name="plus" />新增机构</button>
  </div>

  <div class="toolbar">
    <input v-model="filters.q" class="input" placeholder="机构名称 / 授权编号 / 地址" />
    <select v-model="filters.city" class="select">
      <option value="">全部城市</option>
      <option v-for="c in data.cities || []" :key="c">{{ c }}</option>
    </select>
    <select v-model="filters.status" class="select">
      <option value="">全部状态</option>
      <option value="active">已授权</option>
      <option value="revoked">已撤销</option>
    </select>
  </div>

  <div class="table-wrap" :style="{ opacity: loading ? 0.6 : 1 }">
    <table class="tbl">
      <thead>
        <tr><th>机构</th><th>授权编号</th><th>城市</th><th>授权产品</th><th class="num">医生</th><th class="num">JUVELOOK</th><th class="num">Volume</th><th>状态</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="o in data.items" :key="o.id">
          <td><b>{{ o.name }}</b><div class="muted" style="font-size: 12px">{{ o.address }}</div></td>
          <td class="mono">{{ o.code }}</td>
          <td class="nowrap">{{ o.city }}</td>
          <td class="nowrap">
            <span v-if="o.auth_blue" class="tag blue">JUVELOOK</span>
            <span v-if="o.auth_black" class="tag black" style="margin-left: 4px">Volume</span>
          </td>
          <td class="num"><RouterLink :to="`/doctors?orgId=${o.id}`" style="color: var(--accent-deep)">{{ o.doctor_count }}</RouterLink></td>
          <td class="num">{{ o.auth_blue ? o.blue : '—' }}</td>
          <td class="num">{{ o.auth_black ? o.black : '—' }}</td>
          <td><span class="tag" :class="o.status === 'active' ? 'ok' : 'off'">{{ o.status === 'active' ? '已授权' : '已撤销' }}</span></td>
          <td class="acts">
            <button class="btn sm link" type="button" @click="openForm(o)">编辑</button>
            <button class="btn sm link" style="color: var(--danger)" type="button" @click="remove(o)">删除</button>
          </td>
        </tr>
        <tr v-if="!data.items.length && !loading"><td colspan="9" class="empty-row">没有符合条件的机构</td></tr>
      </tbody>
    </table>
  </div>
  <Pager :total="data.total" :page="data.page" :size="data.size" @go="page = $event" />

  <Modal v-if="editing" :title="editing.id ? '编辑机构' : '新增机构'" @close="editing = null">
    <form id="orgForm" class="form-grid" @submit.prevent="save">
      <div class="f full" :class="{ 'has-err': fieldErrors.name }">
        <label>机构名称 *</label>
        <input v-model="editing.name" class="input" maxlength="60" />
        <div v-if="fieldErrors.name" class="ferr">{{ fieldErrors.name }}</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.city }">
        <label>所在城市 *</label>
        <input v-model="editing.city" class="input" maxlength="20" placeholder="如：上海" />
        <div v-if="fieldErrors.city" class="ferr">{{ fieldErrors.city }}</div>
      </div>
      <div class="f" :class="{ 'has-err': fieldErrors.code }">
        <label>授权编号</label>
        <input v-model="editing.code" class="input" maxlength="32" placeholder="留空自动生成" />
        <div v-if="fieldErrors.code" class="ferr">{{ fieldErrors.code }}</div>
      </div>
      <div class="f full">
        <label>机构地址</label>
        <input v-model="editing.address" class="input" maxlength="120" />
      </div>
      <div class="f full" :class="{ 'has-err': fieldErrors.products }">
        <label>授权产品 *</label>
        <div class="checks">
          <label class="check"><input v-model="editing.auth_blue" type="checkbox" /><span class="cap blue"></span>JUVELOOK</label>
          <label class="check"><input v-model="editing.auth_black" type="checkbox" /><span class="cap black"></span>JUVELOOK Volume</label>
        </div>
        <div v-if="fieldErrors.products" class="ferr">{{ fieldErrors.products }}</div>
      </div>
      <div class="f full">
        <label>授权状态</label>
        <div class="checks">
          <label class="check"><input v-model="editing.status" type="radio" value="active" />已授权</label>
          <label class="check"><input v-model="editing.status" type="radio" value="revoked" />已撤销（机构及其医生前台均不展示）</label>
        </div>
      </div>
    </form>
    <template #footer>
      <button class="btn" type="button" @click="editing = null">取消</button>
      <button class="btn primary" type="submit" form="orgForm" :disabled="saving">保存</button>
    </template>
  </Modal>
</template>
