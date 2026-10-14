import { createApp } from 'vue';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/jost/700.css';
import '../styles.css';
import './admin.css';
import AdminApp from './AdminApp.vue';
import { router } from './router.js';

createApp(AdminApp).use(router).mount('#app');
