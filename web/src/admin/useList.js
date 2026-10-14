import { ref, reactive, watch } from 'vue';
import { toast } from './store.js';

// 列表页通用：筛选条件变化时回到第 1 页并重新加载（关键词输入防抖）
export function useList(fetcher, initial = {}) {
  const filters = reactive({ ...initial });
  const page = ref(1);
  const data = ref({ items: [], total: 0, page: 1, size: 20 });
  const loading = ref(false);
  let seq = 0;

  async function load() {
    const my = ++seq;
    loading.value = true;
    try {
      const res = await fetcher({ ...filters, page: page.value, size: 20 });
      if (my === seq) data.value = res;
    } catch (err) {
      if (my === seq && err.status !== 401) toast.show(err.message, 'err');
    } finally {
      if (my === seq) loading.value = false;
    }
  }

  let t;
  watch(filters, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (page.value !== 1) page.value = 1; // 触发 watch(page) 加载
      else load();
    }, 250);
  });
  watch(page, load);
  load();
  return { filters, page, data, loading, reload: load };
}
