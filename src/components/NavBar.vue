<script setup lang="ts">
import { useAuthStore } from '../stores/auth';
import ThemeSwitcher from './ThemeSwitcher.vue';
import oasLogo from '../assets/oas_logo.png';

const authStore = useAuthStore();
</script>

<template>
  <nav class="navbar">
    <router-link to="/"><img class="logo" :src="oasLogo" alt="Orderly & Steady" /></router-link>
    <div class="nav-actions">
      <ThemeSwitcher />
      <router-link v-if="authStore.isLoggedIn" to="/member" class="user-icon" title="會員">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: var(--bg, #1a1a1a);
  border-bottom: 1px solid var(--border, #333);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  height: 32px;
  width: auto;
  display: block;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-icon {
  display: flex;
  align-items: center;
  color: var(--text-h);
  text-decoration: none;
  transition: opacity 0.2s;
}

.user-icon:hover {
  opacity: 0.7;
}
</style>
