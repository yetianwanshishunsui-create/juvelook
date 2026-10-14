import { createApp } from 'vue';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/jost/700.css';
import '../styles.css';
import './admin.css';
import AdminApp from './AdminApp.vue';
import { router } from './router.js';

// 手机端表格转卡片：把表头文字写到每个单元格的 data-label 上，由 CSS 显示为「标签：值」
const labelCells = (table) => {
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  table.querySelectorAll('tbody tr').forEach((tr) => {
    [...tr.children].forEach((td, i) => {
      if (td.colSpan === 1) td.dataset.label = heads[i] || '';
    });
  });
};

createApp(AdminApp)
  .directive('cards', { mounted: labelCells, updated: labelCells })
  .use(router)
  .mount('#app');
