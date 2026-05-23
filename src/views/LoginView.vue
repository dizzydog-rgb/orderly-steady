<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const { login, register } = useAuthStore();

const tab = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const name = ref('');
const errorMsg = ref('');
const isLoading = ref(false);

async function handleSubmit() {
  errorMsg.value = '';
  isLoading.value = true;
  try {
    if (tab.value === 'login') {
      await login(email.value, password.value);
    } else {
      await register(email.value, password.value, name.value || undefined);
    }
    router.push('/');
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '發生錯誤，請再試一次';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h2 class="title">Orderly & Steady</h2>
      <p class="subtitle">控糖飲食管理系統</p>

      <div class="tabs">
        <button :class="['tab', { active: tab === 'login' }]" @click="tab = 'login'">登入</button>
        <button :class="['tab', { active: tab === 'register' }]" @click="tab = 'register'">註冊</button>
      </div>

      <form @submit.prevent="handleSubmit" class="form">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="your@email.com" autocomplete="email" />
        </div>
        <div class="field">
          <label>密碼</label>
          <input v-model="password" type="password" required placeholder="至少 6 個字元" autocomplete="current-password" />
        </div>
        <div v-if="tab === 'register'" class="field">
          <label>名稱（選填）</label>
          <input v-model="name" type="text" placeholder="您的名稱" autocomplete="name" />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '處理中...' : (tab === 'login' ? '登入' : '註冊') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--social-bg, #242424);
  border: 1px solid var(--border, #333);
  border-radius: 16px;
  padding: 40px 32px;
}

.title {
  margin: 0 0 4px;
  font-size: 1.8rem;
  color: #4ade80;
  text-align: center;
}

.subtitle {
  margin: 0 0 28px;
  color: #888;
  text-align: center;
  font-size: 0.9rem;
}

.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border, #333);
}

.tab {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.95rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.2s, border-color 0.2s;
}

.tab.active {
  color: #4ade80;
  border-bottom-color: #4ade80;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 0.85rem;
  color: #aaa;
}

.field input {
  padding: 10px 12px;
  background: var(--bg, #1a1a1a);
  border: 1px solid var(--border, #444);
  border-radius: 8px;
  color: inherit;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: #4ade80;
}

.error {
  color: #f87171;
  font-size: 0.85rem;
  margin: 0;
}

.submit-btn {
  padding: 12px;
  background: #4ade80;
  color: #0a0a0a;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
