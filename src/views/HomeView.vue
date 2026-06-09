<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import gsap from 'gsap';
import { useAuthStore } from '../stores/auth';
import { useHistoryStore } from '../stores/history';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { apiUrl } from '../utils/apiUrl';
import type { IMealRecord, IScoringResult } from '../types';
import ScoreTrendChart from '../components/ScoreTrendChart.vue';

const authStore = useAuthStore();
const historyStore = useHistoryStore();
const { records, isLoading, error } = storeToRefs(historyStore);
const { fetchHistory, prependRecord } = historyStore;

const slot1 = ref('');
const slot2 = ref('');
const slot3 = ref('');

const slot2Enabled = computed(() => slot1.value.trim().length > 0);
const slot3Enabled = computed(() => slot2Enabled.value && slot2.value.trim().length > 0);

watch(slot1, (val) => { if (!val.trim()) { slot2.value = ''; slot3.value = ''; } });
watch(slot2, (val) => { if (!val.trim()) slot3.value = ''; });

const scoreResult = ref<IScoringResult | null>(null);
const displayScore = ref(0);
const isSubmitting = ref(false);
const submitError = ref('');
let ctx: gsap.Context;

onMounted(() => {
  ctx = gsap.context(() => {});
  fetchHistory();
});

onUnmounted(() => ctx?.revert());

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--font-color)';
  if (score >= 80) return 'var(--score-high)';
  if (score >= 60) return 'var(--score-medium)';
  if (score >= 40) return 'var(--score-low)';
  return 'var(--score-critical)';
}

function animateScore(newScore: number | null) {
  if (newScore === null) return;
  ctx.add(() => {
    gsap.to(displayScore, {
      duration: 0.6,
      value: newScore,
      roundProps: 'value',
      ease: 'power2.out',
    });

    const el = document.querySelector('.score-value') as HTMLElement | null;
    if (!el) return;

    if (newScore >= 80) {
      gsap.fromTo(el, { scale: 1 }, { scale: 1.15, duration: 0.3, yoyo: true, repeat: 3, ease: 'power1.inOut' });
    } else if (newScore >= 60) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    } else if (newScore >= 40) {
      gsap.fromTo(el, { x: 0 }, { x: 6, duration: 0.07, yoyo: true, repeat: 5, ease: 'none' });
    } else if (newScore >= 20) {
      gsap.fromTo(el, { x: 0 }, { x: 10, duration: 0.06, yoyo: true, repeat: 7, ease: 'none' });
    } else {
      gsap.fromTo(el, { x: 0 }, { x: 14, duration: 0.05, yoyo: true, repeat: 10, ease: 'none' });
    }
  });
}

async function handleSubmit() {
  submitError.value = '';
  const foods = [slot1.value.trim(), slot2.value.trim(), slot3.value.trim()].filter(Boolean);
  if (foods.length === 0) return;

  isSubmitting.value = true;
  try {
    const res = await fetchWithAuth(apiUrl('/api/meals'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authStore.user?.email, foods }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      submitError.value = err.message ?? '提交失敗，請再試一次';
      return;
    }
    const data = await res.json();
    scoreResult.value = data.analysis;
    animateScore(data.analysis.totalScore);

    if (data.analysis.totalScore !== null) {
      const newRecord: IMealRecord = {
        id: data.record?.id ?? String(Date.now()),
        totalScore: data.analysis.totalScore,
        tips: data.analysis.tips,
        recordedAt: new Date().toISOString(),
        foodItems: data.record?.foodItems ?? [],
      };
      prependRecord(newRecord);
    }

    slot1.value = '';
    slot2.value = '';
    slot3.value = '';
  } finally {
    isSubmitting.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const SLOT_CHARS: Record<number, string> = { 1: '一', 2: '二', 3: '三' };
function numToChinese(n: number): string { return SLOT_CHARS[n] ?? String(n); }

const FOOD_TYPE_LABELS: Record<string, string> = {
  FIBER: '膳食纖維', PROTEIN: '蛋白質', COMPLEX_CARB: '複合碳水',
  SIMPLE_CARB: '精緻碳水', OTHER: '其他',
};
function foodTypeLabel(type: string | null): string {
  return type ? (FOOD_TYPE_LABELS[type] ?? type) : '—';
}
</script>

<template>
  <div class="home-page">
    <!-- 輸入區 -->
    <section class="input-section">
      <h3>記錄本餐進食順序</h3>
      <div class="slots">
        <div class="slot">
          <label>第一口</label>
          <input v-model="slot1" type="text" placeholder="輸入食物名稱" />
        </div>
        <div class="slot" :class="{ locked: !slot2Enabled }">
          <label>第二口 <span v-if="!slot2Enabled">🔒</span></label>
          <input v-model="slot2" type="text" placeholder="輸入食物名稱" :disabled="!slot2Enabled" />
        </div>
        <div class="slot" :class="{ locked: !slot3Enabled }">
          <label>第三口 <span v-if="!slot3Enabled">🔒</span></label>
          <input v-model="slot3" type="text" placeholder="輸入食物名稱" :disabled="!slot3Enabled" />
        </div>
      </div>

      <p v-if="submitError" class="error">{{ submitError }}</p>

      <button class="submit-btn" @click="handleSubmit" :disabled="isSubmitting || !slot1.trim()">
        {{ isSubmitting ? '計算中...' : '送出評分' }}
      </button>
    </section>

    <!-- 評分結果 -->
    <section v-if="scoreResult" class="result-section">
      <div class="score-card" :style="{ borderColor: scoreColor(scoreResult.totalScore) }">
        <div class="score-label">本餐評分</div>
        <div class="score-value" :style="{ color: scoreColor(scoreResult.totalScore) }">{{ scoreResult.totalScore === null ? '—' : displayScore }}</div>
      </div>

      <div class="breakdown" v-if="scoreResult.breakdown.length > 0">
        <div v-for="b in scoreResult.breakdown" :key="b.slot" class="breakdown-row">
          <span class="slot-label">第{{ numToChinese(b.slot) }}口</span>
          <span class="slot-food">{{ b.label ?? '（空）' }}</span>
          <span class="slot-right">
            <span v-if="b.isOther" class="tag-other">不計分</span>
            <span class="slot-type">{{ foodTypeLabel(b.type) }}</span>
          </span>
        </div>
      </div>

      <div class="tips" v-if="scoreResult.tips.length > 0">
        <h4>建議</h4>
        <ul>
          <li v-for="(tip, i) in scoreResult.tips" :key="i">{{ tip }}</li>
        </ul>
      </div>
    </section>

    <!-- 歷史紀錄 -->
    <section class="history-section">
      <h3>過往進食紀錄</h3>

      <!-- 趨勢圖 -->
      <div v-if="isLoading" class="chart-skeleton skeleton"></div>
      <ScoreTrendChart
        v-else-if="!error && records.length >= 2"
        :records="records"
      />
      <p v-else-if="!error && records.length === 1" class="chart-hint">
        紀錄累積中，再多記錄 1 餐即可顯示趨勢圖
      </p>

      <div v-if="isLoading" class="skeleton-list">
        <div class="skeleton" v-for="i in 3" :key="i"></div>
      </div>

      <div v-else-if="error" class="error-state">
        <p class="error-text">{{ error }}</p>
        <button class="retry-btn" @click="fetchHistory">重試</button>
      </div>

      <div v-else-if="records.length === 0" class="empty-guide">
        <p class="empty-icon">🥗</p>
        <p class="empty-title">還沒有紀錄</p>
        <p class="empty-hint">填寫上方表單，記錄今天第一餐！</p>
      </div>

      <div v-else class="record-list">
        <div v-for="r in records" :key="r.id" class="record-card">
          <div class="record-header">
            <span class="record-date">{{ formatDate(r.recordedAt) }}</span>
            <span class="record-score" :style="{ color: scoreColor(r.totalScore) }">{{ r.totalScore }} 分</span>
          </div>
          <div class="record-foods">
            {{ r.foodItems.map(f => f.label).join(' → ') || '（無食物明細）' }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  box-sizing: border-box;
}

h2, h3 { margin: 0 0 16px; }

.input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}

.slots { display: flex; flex-direction: column; gap: 12px; }

.slot { display: flex; flex-direction: column; gap: 6px; }

.slot label {
  font-size: var(--f14);
  color: var(--font-color);
}

.slot input {
  padding: 10px 14px;
  background: var(--social-bg, #242424);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  color: inherit;
  font-size: var(--f16);
  outline: none;
  transition: border-color 0.2s;
}

.slot input:focus { border-color: var(--accent); }
.slot.locked input { opacity: 0.4; cursor: not-allowed; }
.slot.locked label { opacity: 0.5; }

.error {
  color: var(--color-danger);
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
}

.submit-btn:hover:not(:disabled) { opacity: 0.85; }
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.result-section { display: flex; flex-direction: column; gap: 16px; }

.score-card {
  border: 3px solid var(--score-high);
  padding: 20px 28px;
  border-radius: 14px;
  background: var(--social-bg, #242424);
  transition: border-color 0.3s;
  text-align: center;
}

.score-label {
  font-size: var(--f16);
  color: var(--font-color);
  margin-bottom: 4px;
}

.score-value {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1;
}

.breakdown {
  background: var(--social-bg, #242424);
  border-radius: 10px;
  overflow: hidden;
}

.breakdown-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #333);
  gap: 12px;
}

.breakdown-row:last-child { border-bottom: none; }

.slot-label { font-size: var(--f14); color: var(--font-color); width: 48px; flex-shrink: 0; }
.slot-food { flex: 1; font-size: var(--f16); }
.slot-right { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-shrink: 0; width: 96px; }
.slot-type { font-size: var(--f14); color: var(--font-color); }

.tag-other {
  font-size: var(--f14);
  padding: 2px 8px;
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
  border-radius: 999px;
  white-space: nowrap;
}

.tips {
  background: rgba(250, 204, 21, 0.08);
  border-left: 4px solid var(--score-medium);
  border-radius: 8px;
  padding: 14px 16px;
}

.tips h4 { margin: 0 0 8px; color: var(--score-medium); font-size: var(--f16); }
.tips ul { margin: 0; padding-left: 18px; }
.tips li { font-size: var(--f16); color: var(--score-medium); margin-bottom: 4px; text-align: left; }

.history-section { display: flex; flex-direction: column; gap: 16px; }

.chart-skeleton {
  height: 220px;
  border-radius: 10px;
}

.chart-hint {
  font-size: var(--f14);
  color: var(--font-color);
  text-align: center;
  margin: 0;
  padding: 12px 0;
}

.skeleton-list { display: flex; flex-direction: column; gap: 10px; }
.skeleton {
  height: 64px;
  background: var(--social-bg, #242424);
  border-radius: 10px;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 10px;
}

.error-text { color: var(--color-danger); font-size: var(--f16); margin: 0; }

.retry-btn {
  padding: 6px 18px;
  background: none;
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  border-radius: 6px;
  font-size: var(--f14);
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover { background: rgba(248, 113, 113, 0.1); }

.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  color: var(--font-color);
}

.empty-icon { font-size: 2.4rem; margin: 0; }

.empty-title { font-size: var(--f18); font-weight: 600; color: var(--font-color); margin: 0; }

.empty-hint { font-size: var(--f14); color: var(--font-color); margin: 0; }

.record-list { display: flex; flex-direction: column; gap: 10px; }

.record-card {
  background: var(--social-bg, #242424);
  border: 1px solid var(--border-color, #333);
  border-radius: 10px;
  padding: 14px 16px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.record-date { font-size: var(--f14); color: var(--font-color); }
.record-score { font-weight: 700; font-size: var(--f18); }
.record-foods { font-size: var(--f16); color: var(--font-color); }

@media (max-width: 1024px) {
  .home-page { padding: 24px 20px 48px; gap: 24px; }
}

@media (max-width: 768px) {
  .home-page { padding: 20px 16px 40px; gap: 20px; }
  .score-card { padding: 16px 20px; }
  .breakdown-row { gap: 8px; }
}

@media (max-width: 480px) {
  .home-page { padding: 32px 12px; gap: 16px; }
  .input-section h3 { margin-bottom: 0; }
  .submit-btn{ margin-top: 8px}
  .slot-label { width: 36px; }
  .breakdown-row { flex-wrap: wrap; }
  .history-section{ margin-top: 16px}
  .record-card { padding: 10px 12px; }
}
</style>
