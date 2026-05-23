<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
</script>

<template>
  <nav class="navbar">
    <span class="logo">Orderly & Steady</span>
    <router-link v-if="authStore.isLoggedIn" to="/member" class="user-icon" title="會員">👤</router-link>
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
  font-size: 1.2rem;
  font-weight: 700;
  color: #4ade80;
  letter-spacing: 0.03em;
}

.user-icon {
  font-size: 1.4rem;
  text-decoration: none;
  transition: opacity 0.2s;
}

.user-icon:hover {
  opacity: 0.7;
}
</style>
