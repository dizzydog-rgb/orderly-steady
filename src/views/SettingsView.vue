<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const nickname = ref(authStore.user?.name ?? '');
const nicknameError = ref('');
const nicknameSuccess = ref('');
const isSavingNickname = ref(false);

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const isSavingPassword = ref(false);

async function handleNicknameSubmit() {
  nicknameError.value = '';
  nicknameSuccess.value = '';
  isSavingNickname.value = true;
  try {
    await authStore.updateNickname(nickname.value.trim());
    nicknameSuccess.value = '名稱已更新';
  } catch (e: unknown) {
    nicknameError.value = e instanceof Error ? e.message : '發生錯誤，請再試一次';
  } finally {
    isSavingNickname.value = false;
  }
}

async function handlePasswordSubmit() {
  passwordError.value = '';
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '兩次輸入的新密碼不一致';
    return;
  }
  isSavingPassword.value = true;
  try {
    await authStore.changePassword(currentPassword.value, newPassword.value);
    router.push('/login');
  } catch (e: unknown) {
    passwordError.value = e instanceof Error ? e.message : '發生錯誤，請再試一次';
  } finally {
    isSavingPassword.value = false;
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-card">
      <h2>帳號設定</h2>

      <section class="section">
        <div class="info-row">
          <span class="label">Email</span>
          <span class="value" data-testid="settings-email">{{ authStore.user?.email }}</span>
        </div>
        <p class="hint">Email 為帳號識別碼，不可變更。</p>
      </section>

      <section class="section">
        <h3>變更名稱</h3>
        <form @submit.prevent="handleNicknameSubmit" class="form">
          <div class="field">
            <label for="nickname">名稱</label>
            <input
              id="nickname"
              v-model="nickname"
              type="text"
              required
              maxlength="50"
              placeholder="您的名稱"
              autocomplete="nickname"
              data-testid="nickname-input"
            />
          </div>

          <p v-if="nicknameError" class="error" data-testid="nickname-error">{{ nicknameError }}</p>
          <p v-if="nicknameSuccess" class="success" data-testid="nickname-success">
            {{ nicknameSuccess }}
          </p>

          <button
            type="submit"
            class="submit-btn"
            :disabled="isSavingNickname"
            data-testid="nickname-submit"
          >
            {{ isSavingNickname ? '更新中...' : '更新名稱' }}
          </button>
        </form>
      </section>

      <section class="section">
        <h3>變更密碼</h3>
        <form @submit.prevent="handlePasswordSubmit" class="form">
          <div class="field">
            <label for="current-password">目前密碼</label>
            <input
              id="current-password"
              v-model="currentPassword"
              type="password"
              required
              autocomplete="current-password"
              data-testid="current-password-input"
            />
          </div>
          <div class="field">
            <label for="new-password">新密碼</label>
            <input
              id="new-password"
              v-model="newPassword"
              type="password"
              required
              minlength="8"
              placeholder="至少 8 個字元"
              autocomplete="new-password"
              data-testid="new-password-input"
            />
          </div>
          <div class="field">
            <label for="confirm-password">確認新密碼</label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              data-testid="confirm-password-input"
            />
          </div>

          <p v-if="passwordError" class="error" data-testid="password-error">{{ passwordError }}</p>
          <p class="hint">變更密碼後所有裝置都會登出，需使用新密碼重新登入。</p>

          <button
            type="submit"
            class="submit-btn"
            :disabled="isSavingPassword"
            data-testid="password-submit"
          >
            {{ isSavingPassword ? '變更中...' : '變更密碼' }}
          </button>
        </form>
      </section>

      <router-link to="/member" class="back-link">← 返回會員中心</router-link>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 57px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 20px;
}

.settings-card {
  width: 100%;
  max-width: 420px;
  background: var(--social-bg, #242424);
  border: 1px solid var(--border-color, #333);
  border-radius: 16px;
  padding: 36px 32px;
}

h2 { margin: 0 0 24px; font-size: var(--f24); }

h3 { margin: 0 0 12px; font-size: var(--f18); }

.section {
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color, #333);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.label { font-size: var(--f14); color: var(--font-color); }

.value { font-size: var(--f16); }

.hint {
  margin: 0;
  font-size: var(--f14);
  color: var(--font-color);
}

.form { display: flex; flex-direction: column; gap: 16px; }

.field { display: flex; flex-direction: column; gap: 6px; }

.field label {
  font-size: var(--f14);
  color: var(--font-color);
}

.field input {
  padding: 10px 12px;
  background: var(--bg-color, #1a1a1a);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  color: inherit;
  font-size: var(--f16);
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus { border-color: var(--accent); }

.error {
  color: var(--color-danger);
  font-size: var(--f14);
  margin: 0;
}

.success {
  color: var(--accent);
  font-size: var(--f14);
  margin: 0;
}

.submit-btn {
  padding: 12px;
  background: var(--accent);
  color: var(--font-color-h);
  border: none;
  border-radius: 8px;
  font-size: var(--f18);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) { opacity: 0.85; }
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.back-link { color: var(--accent); text-decoration: none; font-size: var(--f16); }
.back-link:hover { text-decoration: underline; }

@media (max-width: 1024px) {
  .settings-card { padding: 28px 24px; }
}

@media (max-width: 768px) {
  .settings-card { padding: 24px 20px; }
}

@media (max-width: 480px) {
  .settings-page { padding: 20px 12px; }
  .settings-card { padding: 20px 16px; border-radius: 12px; }
  .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
}
</style>
