<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import type { BackendFoodType } from "../types";

const props = defineProps<{
  type: string | null;
  slotNumber: number;
  editable: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [type: BackendFoodType] }>();

const FOOD_TYPE_LABELS: Record<BackendFoodType, string> = {
  FIBER: "膳食纖維",
  PROTEIN: "蛋白質",
  COMPLEX_CARB: "複合碳水",
  SIMPLE_CARB: "精緻碳水",
  OTHER: "其他",
};
const OPTIONS = Object.keys(FOOD_TYPE_LABELS) as BackendFoodType[];

const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);

const currentLabel = computed(() =>
  props.type
    ? (FOOD_TYPE_LABELS[props.type as BackendFoodType] ?? props.type)
    : "—",
);

function onOutsidePointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close();
}

// 只處理 Tab 離開的情況；relatedTarget 為 null 時（例如 Safari 點擊按鈕不會移動焦點）
// 交給 pointerdown 判斷，否則選單會在點到選項前就先被關掉
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && !root.value?.contains(next)) close();
}

async function open() {
  isOpen.value = true;
  document.addEventListener("pointerdown", onOutsidePointerDown);
  await nextTick();
  const selected = menu.value?.querySelector<HTMLElement>('[aria-selected="true"]');
  (selected ?? menu.value?.querySelector<HTMLElement>("button"))?.focus();
}

function close() {
  isOpen.value = false;
  document.removeEventListener("pointerdown", onOutsidePointerDown);
}

function toggle() {
  if (isOpen.value) close();
  else open();
}

function closeAndRefocus() {
  if (!isOpen.value) return;
  close();
  trigger.value?.focus();
}

function select(type: BackendFoodType) {
  closeAndRefocus();
  if (type !== props.type) emit("change", type);
}

function moveFocus(step: 1 | -1) {
  const options = Array.from(menu.value?.querySelectorAll<HTMLElement>("button") ?? []);
  const index = options.indexOf(document.activeElement as HTMLElement);
  options[(index + step + options.length) % options.length]?.focus();
}

onBeforeUnmount(close);
</script>

<template>
  <span
    ref="root"
    class="food-type-editor"
    @keydown.esc="closeAndRefocus"
    @focusout="onFocusOut"
  >
    <span class="type-label" :data-testid="`food-type-label-${slotNumber}`">{{
      currentLabel
    }}</span>

    <template v-if="editable">
      <button
        ref="trigger"
        type="button"
        class="edit-btn"
        aria-label="修改分類"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
        :disabled="disabled"
        :data-testid="`food-type-edit-${slotNumber}`"
        @click="toggle"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

      <div
        v-if="isOpen"
        ref="menu"
        class="type-menu"
        role="listbox"
        aria-label="選擇食物類別"
        :data-testid="`food-type-menu-${slotNumber}`"
        @keydown.down.prevent="moveFocus(1)"
        @keydown.up.prevent="moveFocus(-1)"
      >
        <button
          v-for="option in OPTIONS"
          :key="option"
          type="button"
          role="option"
          class="type-option"
          :class="{ selected: option === type }"
          :aria-selected="option === type"
          :data-testid="`food-type-option-${slotNumber}-${option}`"
          @click="select(option)"
        >
          <span>{{ FOOD_TYPE_LABELS[option] }}</span>
          <span v-if="option === type" aria-hidden="true">✓</span>
        </button>
      </div>
    </template>
  </span>
</template>

<style scoped>
.food-type-editor {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.type-label {
  font-size: var(--f14);
  color: var(--font-color);
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--font-color);
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.edit-btn:hover:not(:disabled),
.edit-btn[aria-expanded="true"] {
  color: var(--accent);
  background: var(--accent-bg);
}

.edit-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.edit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 脫離文件流：直接蓋在下方的列與建議區塊上，不推擠其他元件 */
.type-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 148px;
  padding: 4px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: var(--shadow);
}

.type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--font-color-h);
  font: inherit;
  font-size: var(--f14);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.type-option:hover,
.type-option:focus-visible {
  background: var(--accent-bg);
  outline: none;
}

.type-option.selected {
  color: var(--accent);
  font-weight: 600;
}
</style>
