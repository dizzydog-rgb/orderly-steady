<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import gsap from 'gsap';
import { useAuthStore } from '../stores/auth';
import { useHistory } from '../composables/useHistory';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import type { IMealRecord } from '../types';

const authStore = useAuthStore();
const { records, isLoading, error, fetchHistory, prependRecord } = useHistory();

const slot1 = ref('');
const slot2 = ref('');
const slot3 = ref('');

const slot2Enabled = computed(() => slot1.value.trim().length > 0);
const slot3Enabled = computed(() => slot2Enabled.value && slot2.value.trim().length > 0);

watch(slot1, (val) => { if (!val.trim()) { slot2.value = ''; slot3.value = ''; } });
watch(slot2, (val) => { if (!val.trim()) slot3.value = ''; });

const scoreResult = ref<{ totalScore: number; breakdown: { slot: number; input: string | null; slotMax: number; score: number }[]; tips: string[] } | null>(null);
const displayScore = ref(0);
const isSubmitting = ref(false);
const submitError = ref('');
let ctx: gsap.Context;

onMounted(() => {
  ctx = gsap.context(() => {});
  fetchHistory();
});

onUnmounted(() => ctx?.revert());

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 60) return '#facc15';
  if (score >= 40) return '#fb923c';
  return '#f87171';
}

function animateScore(newScore: number) {
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
    const res = await fetchWithAuth('/api/meals', {
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

    const newRecord: IMealRecord = {
      id: data.record?.id ?? String(Date.now()),
      totalScore: data.analysis.totalScore,
      tips: data.analysis.tips,
      recordedAt: new Date().toISOString(),
      foodItems: data.record?.foodItems ?? [],
    };
    prependRecord(newRecord);

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
        <div class="score-value" :style="{ color: scoreColor(scoreResult.totalScore) }">{{ displayScore }}</div>
      </div>

      <div class="breakdown" v-if="scoreResult.breakdown.length > 0">
        <div v-for="b in scoreResult.breakdown" :key="b.slot" class="breakdown-row">
          <span class="slot-label">第{{ ({ 1: '一', 2: '二', 3: '三' } as Record<number,string>)[b.slot] }}口</span>
          <span class="slot-input">{{ b.input ? b.input : '（空）' }}</span>
          <span class="slot-score" :style="{ color: scoreColor(b.score / b.slotMax * 100) }">
            {{ b.score }} / {{ b.slotMax }}
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
  max-width: 600px;
  margin: 0 auto;
  padding: 32px 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

h2, h3 {
  margin: 0 0 16px;
}

/* 輸入區 */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slot label {
  font-size: 0.85rem;
  color: #aaa;
}

.slot input {
  padding: 10px 14px;
  background: var(--social-bg, #242424);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  color: inherit;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.slot input:focus {
  border-color: #4ade80;
}

.slot.locked input {
  opacity: 0.4;
  cursor: not-allowed;
}

.slot.locked label {
  opacity: 0.5;
}

.error {
  color: #f87171;
  font-size: 0.85rem;
  margin: 0;
}

.submit-btn {
  padding: 12px;
  background: #4ade80;
  color: #0a0a0a;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.submit-btn:hover:not(:disabled) { opacity: 0.85; }
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 評分結果 */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-card {
  border: 3px solid #4ade80;
  padding: 20px 28px;
  border-radius: 14px;
  background: var(--social-bg, #242424);
  transition: border-color 0.3s;
  text-align: center;
}

.score-label {
  font-size: 0.9rem;
  color: #888;
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

.slot-label { font-size: 0.8rem; color: #888; width: 48px; flex-shrink: 0; }
.slot-input { flex: 1; font-size: 0.9rem; }
.slot-score { font-size: 0.9rem; font-weight: 600; }

.tips {
  background: rgba(250, 204, 21, 0.08);
  border-left: 4px solid #facc15;
  border-radius: 8px;
  padding: 14px 16px;
}

.tips h4 { margin: 0 0 8px; color: #facc15; font-size: 0.9rem; }
.tips ul { margin: 0; padding-left: 18px; }
.tips li { font-size: 0.88rem; color: #d4b017; margin-bottom: 4px; }

/* 歷史紀錄 */
.history-section { display: flex; flex-direction: column; }

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

.error-text {
  color: #f87171;
  font-size: 0.9rem;
  margin: 0;
}

.retry-btn {
  padding: 6px 18px;
  background: none;
  border: 1px solid #f87171;
  color: #f87171;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}

.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  color: #666;
}

.empty-icon {
  font-size: 2.4rem;
  margin: 0;
}

.empty-title {
  font-size: 1rem;
  font-weight: 600;
  color: #888;
  margin: 0;
}

.empty-hint {
  font-size: 0.85rem;
  color: #555;
  margin: 0;
}

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

.record-date { font-size: 0.82rem; color: #666; }
.record-score { font-weight: 700; font-size: 1rem; }
.record-foods { font-size: 0.88rem; color: #aaa; }
</style>
