<script setup lang="ts">
import { computed } from 'vue';
import { useLang, type Lang } from '../composables/useLang';

const { lang, setLang } = useLang();

const options: { value: Lang; label: string }[] = [
  { value: 'cn', label: 'CN' },
  { value: 'en', label: 'EN' },
];

const activeIndex = computed(() => options.findIndex((o) => o.value === lang.value));
</script>

<template>
  <div class="switcher" role="radiogroup" aria-label="語言切換">
    <div
      class="indicator"
      :style="{ transform: `translateX(calc(${activeIndex} * 100%))` }"
      aria-hidden="true"
    ></div>
    <button
      v-for="option in options"
      :key="option.value"
      class="option"
      :class="{ active: lang === option.value }"
      role="radio"
      :aria-checked="lang === option.value"
      @click="setLang(option.value)"
    >
      {{ option.label }}
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
  width: calc((100% - 8px) / 2);
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
  padding: 5px 14px;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
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
