<script setup lang="ts">
import { ref, computed } from 'vue';
import { FoodType } from './types';
import type { IMealItem } from './types';
import { calculateMealScore } from './services/scoringAlgorithm';

const mealSequence = ref<IMealItem[]>([]);

const scoreResult = computed(() => {
  const types = mealSequence.value.map(item => item.type);
  return calculateMealScore(types);
});

const scoreColor = computed(() => {
  const score = scoreResult.value.totalScore;
  if (score >= 80) return '#4ade80'; // Green
  if (score >= 60) return '#facc15'; // Yellow
  return '#f87171'; // Red
});

function addFood(type: FoodType, label: string) {
  mealSequence.value.push({
    id: Math.random().toString(36).substring(7),
    type,
    label,
  });
}

function clearSequence() {
  mealSequence.value = [];
}

const foodButtons = [
  { type: FoodType.FIBER, label: '膳食纖維 (F)', class: 'btn-fiber' },
  { type: FoodType.PROTEIN, label: '蛋白質 (P)', class: 'btn-protein' },
  { type: FoodType.COMPLEX_CARB, label: '複合碳水 (CC)', class: 'btn-cc' },
  { type: FoodType.SIMPLE_CARB, label: '精緻碳水 (SC)', class: 'btn-sc' },
] as const;
</script>

<template>
  <div id="center">
    <h1>控糖進食順序測試</h1>
    
    <div class="score-card" :style="{ borderColor: scoreColor }">
      <div class="score-label">當前評分</div>
      <div class="score-value" :style="{ color: scoreColor }">{{ scoreResult.totalScore }}</div>
    </div>

    <div class="controls">
      <button 
        v-for="btn in foodButtons" 
        :key="btn.type" 
        @click="addFood(btn.type, btn.label)"
        :class="['food-btn', btn.class]"
      >
        {{ btn.label }}
      </button>
    </div>

    <div class="sequence-container">
      <h3>進食序列</h3>
      <div v-if="mealSequence.length === 0" class="empty-msg">請點選上方按鈕開始記錄</div>
      <div class="sequence-list">
        <div 
          v-for="(item, index) in mealSequence" 
          :key="item.id" 
          class="sequence-item"
        >
          <span class="index">{{ index + 1 }}</span>
          <span class="label">{{ item.label }}</span>
        </div>
      </div>
      <button v-if="mealSequence.length > 0" @click="clearSequence" class="clear-btn">清除全部</button>
    </div>

    <div class="analysis" v-if="scoreResult.breakdown.length > 0">
      <h3>得分分析</h3>
      <ul>
        <li v-for="(item, index) in scoreResult.breakdown" :key="index">
          {{ foodButtons.find(b => b.type === item.type)?.label }}: 
          {{ item.baseScore }} x {{ item.modifier }} = <strong>{{ item.finalItemScore }}</strong>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.score-card {
  border: 4px solid var(--border);
  padding: 20px 40px;
  border-radius: 16px;
  margin-bottom: 30px;
  background: var(--bg);
  transition: border-color 0.3s;
}

.score-label {
  font-size: 1.2rem;
  color: var(--text);
}

.score-value {
  font-size: 4rem;
  font-weight: bold;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 30px;
}

.food-btn {
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.food-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.btn-fiber { border-left: 5px solid #4ade80; }
.btn-protein { border-left: 5px solid #60a5fa; }
.btn-cc { border-left: 5px solid #fb923c; }
.btn-sc { border-left: 5px solid #f87171; }

.sequence-container {
  width: 100%;
  max-width: 500px;
  background: var(--social-bg);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 30px;
}

.sequence-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 15px 0;
}

.sequence-item {
  display: flex;
  align-items: center;
  background: var(--bg);
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.index {
  background: var(--border);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.8rem;
  margin-right: 12px;
}

.clear-btn {
  margin-top: 10px;
  background: none;
  border: none;
  color: #f87171;
  text-decoration: underline;
  cursor: pointer;
}

.analysis {
  text-align: left;
  font-size: 0.9rem;
}

.analysis ul {
  list-style: none;
  padding: 0;
}

.analysis li {
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px dashed var(--border);
}

.empty-msg {
  color: var(--text);
  font-style: italic;
  margin: 20px 0;
}
</style>
