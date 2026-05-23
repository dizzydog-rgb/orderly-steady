import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import HomeView from '../views/HomeView.vue';
import MemberView from '../views/MemberView.vue';

const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/', component: HomeView },
  { path: '/member', component: MemberView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (to.meta.public) {
    if (authStore.isLoggedIn) return '/';
    return true;
  }

  if (!authStore.isLoggedIn) {
    const ok = await authStore.refreshAccessToken();
    if (!ok) return '/login';
  }

  return true;
});

export default router;
