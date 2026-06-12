import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import HomeView from '../views/HomeView.vue';
import MemberView from '../views/MemberView.vue';
import WhyView from '../views/WhyView.vue';

const routes = [
  { path: '/login', component: LoginView, meta: { public: true, authRedirect: true } },
  { path: '/why', component: WhyView, meta: { public: true } },
  { path: '/', component: HomeView, meta: { public: true } },
  { path: '/member', component: MemberView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 首次導航時嘗試以 refresh cookie 靜默恢復 session（public 路由也適用，
// 否則已登入使用者重整頁面後會被當成訪客）
let sessionRestoreAttempted = false;

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (!authStore.isLoggedIn && !sessionRestoreAttempted) {
    sessionRestoreAttempted = true;
    await authStore.refreshAccessToken();
  }

  if (to.meta.public) {
    if (to.meta.authRedirect && authStore.isLoggedIn) return '/';
    return true;
  }

  if (!authStore.isLoggedIn) {
    const ok = await authStore.refreshAccessToken();
    if (!ok) return '/login';
  }

  return true;
});

export default router;
