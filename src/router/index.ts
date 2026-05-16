import { createRouter, createWebHistory } from 'vue-router';
import { isLoggedIn, refreshAccessToken } from '../composables/useAuth';
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
  if (to.meta.public) {
    if (isLoggedIn.value) return '/';
    return true;
  }

  if (!isLoggedIn.value) {
    const ok = await refreshAccessToken();
    if (!ok) return '/login';
  }

  return true;
});

export default router;
