import { createApp } from 'vue';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import '@fontsource/jost/700.css';
import './styles.css';
import App from './App.vue';
import { router } from './router.js';

createApp(App).use(router).mount('#app');
