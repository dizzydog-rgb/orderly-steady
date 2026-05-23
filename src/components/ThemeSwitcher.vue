<script setup lang="ts">
import { computed } from 'vue';
import { useTheme, type ThemeMode } from '../composables/useTheme';

const { themeMode, setTheme } = useTheme();

const options: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const activeIndex = computed(() => options.findIndex((o) => o.value === themeMode.value));
</script>

<template>
  <div class="switcher" role="radiogroup" aria-label="主題模式">
    <div
      class="indicator"
      :style="{ transform: `translateX(calc(${activeIndex} * 100%))` }"
      aria-hidden="true"
    ></div>

    <button
      v-for="option in options"
      :key="option.value"
      class="option"
      :class="{ active: themeMode === option.value }"
      role="radio"
      :aria-checked="themeMode === option.value"
      @click="setTheme(option.value)"
    >
      <!-- Monitor icon -->
      <svg v-if="option.value === 'system'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
      <!-- Sun icon -->
      <svg v-else-if="option.value === 'light'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <!-- Moon icon -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.switcher {
  position: relative;
  display: flex;
  padding: 4px;
  background: var(--switcher-bg);
  border-radius: 999px;
}

.indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc((100% - 8px) / 3);
  height: calc(100% - 8px);
  background: var(--switcher-indicator);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease-in-out;
  pointer-events: none;
}

.option {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  min-width: 36px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--switcher-inactive);
  transition: color 0.2s;
  white-space: nowrap;
}

.option:hover {
  color: var(--switcher-hover);
}

.option.active {
  color: var(--switcher-active);
}
</style>
