<script setup lang="ts">
import NavBar from './components/NavBar.vue';
import { useTheme } from './composables/useTheme';

useTheme();
</script>

<template>
  <NavBar />
  <RouterView />
</template>
