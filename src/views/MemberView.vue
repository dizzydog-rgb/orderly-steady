<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const isLoggingOut = ref(false);

async function handleLogout() {
  isLoggingOut.value = true;
  await authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="member-page">
    <div class="member-card">
      <h2>個人資料</h2>
      <div class="info-row">
        <span class="label">Email</span>
        <span class="value">{{ authStore.user?.email }}</span>
      </div>
      <div class="info-row">
        <span class="label">名稱</span>
        <span class="value">{{ authStore.user?.name ?? '（未設定）' }}</span>
      </div>

      <div class="actions">
        <router-link to="/" class="back-link">← 返回首頁</router-link>
        <button class="logout-btn" @click="handleLogout" :disabled="isLoggingOut">
          {{ isLoggingOut ? '登出中...' : '登出' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-page {
  min-height: calc(100vh - 57px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}

.member-card {
  width: 100%;
  max-width: 420px;
  background: var(--social-bg, #242424);
  border: 1px solid var(--border-color, #333);
  border-radius: 16px;
  padding: 36px 32px;
}

h2 { margin: 0 0 24px; font-size: var(--f24); }

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color, #333);
}

.label { font-size: var(--f14); color: var(--font-color); }

.value { font-size: var(--f16); }

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
}

.back-link { color: var(--accent); text-decoration: none; font-size: var(--f16); }
.back-link:hover { text-decoration: underline; }

.logout-btn {
  padding: 8px 20px;
  background: none;
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  border-radius: 8px;
  cursor: pointer;
  font-size: var(--f16);
  transition: background 0.2s;
}

.logout-btn:hover { background: rgba(248, 113, 113, 0.1); }

@media (max-width: 1024px) {
  .member-card { padding: 28px 24px; }
}

@media (max-width: 768px) {
  .member-card { padding: 24px 20px; }
}

@media (max-width: 480px) {
  .member-page { padding: 20px 12px; }
  .member-card { padding: 20px 16px; border-radius: 12px; }
  .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .actions { gap: 12px; }
}
</style>
