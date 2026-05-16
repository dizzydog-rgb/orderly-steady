<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { user, logout } = useAuth();

async function handleLogout() {
  await logout();
  router.push('/login');
}
</script>

<template>
  <div class="member-page">
    <div class="member-card">
      <h2>個人資料</h2>
      <div class="info-row">
        <span class="label">Email</span>
        <span class="value">{{ user?.email }}</span>
      </div>
      <div class="info-row">
        <span class="label">名稱</span>
        <span class="value">{{ user?.name ?? '（未設定）' }}</span>
      </div>

      <div class="actions">
        <router-link to="/" class="back-link">← 返回首頁</router-link>
        <button class="logout-btn" @click="handleLogout">登出</button>
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
  border: 1px solid var(--border, #333);
  border-radius: 16px;
  padding: 36px 32px;
}

h2 {
  margin: 0 0 24px;
  font-size: 1.4rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border, #333);
}

.label {
  font-size: 0.85rem;
  color: #888;
}

.value {
  font-size: 0.95rem;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
}

.back-link {
  color: #4ade80;
  text-decoration: none;
  font-size: 0.9rem;
}

.back-link:hover {
  text-decoration: underline;
}

.logout-btn {
  padding: 8px 20px;
  background: none;
  border: 1px solid #f87171;
  color: #f87171;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}
</style>
