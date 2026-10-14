import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

// 详情页加载：随路由 id 变化重新拉取（医生 ↔ 机构互跳会复用组件）
export function useDetail(fetcher) {
  const route = useRoute();
  const data = ref(null);
  const error = ref(null);
  const loading = ref(true);
  let seq = 0;

  async function load() {
    const id = route.params.id;
    if (!id) return;
    const my = ++seq;
    loading.value = true;
    error.value = null;
    try {
      const res = await fetcher(id);
      if (my === seq) data.value = res;
    } catch (err) {
      if (my === seq) {
        data.value = null;
        error.value = err;
      }
    } finally {
      if (my === seq) loading.value = false;
    }
  }

  watch(() => route.params.id, load, { immediate: true });
  return { data, error, loading, reload: load };
}
