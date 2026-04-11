import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { MotionPlugin } from '@vueuse/motion';

import App from './App.vue';
import { toastPlugin } from './plugins/toast.plugin';
import { router } from './router';
import './styles.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(MotionPlugin);
app.use(toastPlugin);
app.mount('#app');
