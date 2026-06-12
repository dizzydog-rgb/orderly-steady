<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import ThemeSwitcher from './ThemeSwitcher.vue';
import oasLogo from '../assets/oas_logo.png';

const authStore = useAuthStore();
const menuOpen = ref(false);

function closeMenu() {
  menuOpen.value = false;
}
</script>

<template>
  <nav class="navbar">
    <!-- 左側：logo + 導覽連結 -->
    <div class="nav-left">
      <router-link to="/" @click="closeMenu">
        <img class="logo" :src="oasLogo" alt="Orderly & Steady" />
      </router-link>
      <router-link to="/why" class="nav-link">控糖科學</router-link>
    </div>

    <!-- 右側：主題切換 + 使用者 icon -->
    <div class="nav-right">
      <ThemeSwitcher />
      <router-link v-if="!authStore.isLoggedIn" to="/login" class="nav-link">登入</router-link>
      <router-link v-if="authStore.isLoggedIn" to="/member" class="user-icon" title="會員">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </router-link>
      <button
        class="hamburger"
        @click="menuOpen = !menuOpen"
        :aria-expanded="menuOpen"
        aria-label="選單"
      >
        {{ menuOpen ? '✕' : '☰' }}
      </button>
    </div>

    <!-- 行動版展開選單 -->
    <div v-if="menuOpen" class="mobile-menu">
      <router-link to="/" class="mobile-link" @click="closeMenu">首頁</router-link>
      <router-link to="/why" class="mobile-link" @click="closeMenu">控糖科學</router-link>
      <router-link v-if="!authStore.isLoggedIn" to="/login" class="mobile-link" @click="closeMenu">登入 / 註冊</router-link>
      <router-link v-if="authStore.isLoggedIn" to="/member" class="mobile-link" @click="closeMenu">我的會員</router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: var(--bg-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  height: 32px;
  width: auto;
  display: block;
}

.nav-link {
  font-size: var(--f16);
  font-weight: 500;
  color: var(--font-color-h);
  text-decoration: none;
  transition: color 0.2s;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--accent);
}

.user-icon {
  display: flex;
  align-items: center;
  color: var(--font-color-h);
  text-decoration: none;
  transition: opacity 0.2s;
}

.user-icon:hover {
  opacity: 0.7;
}

.hamburger {
  display: none;
  background: none;
  border: none;
  color: var(--font-color-h);
  font-size: var(--f20);
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

.mobile-menu {
  width: 100%;
  display: none;
  flex-direction: column;
  background: var(--bg-color);
}

.mobile-link {
  padding: 14px 24px;
  color: var(--font-color-h);
  text-decoration: none;
  font-size: var(--f16);
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s, color 0.2s;
}

.mobile-link:hover {
  background: var(--accent-bg);
  color: var(--accent);
}

@media (max-width: 1024px) {
  .navbar { padding: 12px 20px; }
}

@media (max-width: 768px) {
  .logo { height: 28px; }
  .nav-link { font-size: var(--f14); }
}

@media (max-width: 480px) {
  .navbar { padding: 10px 16px 0 16px; }
  .nav-right { gap: 8px; }
  .nav-link { display: none; }
  .user-icon { display: none; }
  .hamburger { display: flex; align-items: center; }
  .mobile-menu { display: flex; }
  .mobile-link { padding: 8px 16px; }
}
</style>
