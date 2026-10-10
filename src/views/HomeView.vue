<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import gsap from "gsap";
import { useAuthStore } from "../stores/auth";
import { useHistoryStore } from "../stores/history";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import { apiUrl } from "../utils/apiUrl";
import type {
  BackendFoodType,
  IApiErrorResponse,
  IFoodTypeCorrectionResponse,
  IMealRecord,
  IScoringResult,
  IUpdateFoodTypeRequest,
  IUpsertFoodOverrideRequest,
} from "../types";
import ScoreTrendChart from "../components/ScoreTrendChart.vue";
import FoodTypeEditor from "../components/FoodTypeEditor.vue";

const authStore = useAuthStore();
const historyStore = useHistoryStore();
const { records, isLoading, error } = storeToRefs(historyStore);
const { fetchHistory, prependRecord, updateRecord, removeRecord } =
  historyStore;

const slot1 = ref("");
const slot2 = ref("");
const slot3 = ref("");

const guestEmail = ref("");
const guestEmailError = ref("");

const slot2Enabled = computed(() => slot1.value.trim().length > 0);
const slot3Enabled = computed(
  () => slot2Enabled.value && slot2.value.trim().length > 0,
);

watch(slot1, (val) => {
  if (!val.trim()) {
    slot2.value = "";
    slot3.value = "";
  }
});
watch(slot2, (val) => {
  if (!val.trim()) slot3.value = "";
});

const scoreResult = ref<IScoringResult | null>(null);
const displayScore = ref(0);
const isSubmitting = ref(false);
const submitError = ref("");

// 修正分類用：當餐已寫入的紀錄 id（全為「其他」時沒有紀錄，為 null）與送出的食物清單
const currentRecordId = ref<string | null>(null);
const lastSubmittedFoods = ref<string[]>([]);
const isCorrecting = ref(false);
const correctionError = ref("");
let ctx: gsap.Context;

onMounted(() => {
  ctx = gsap.context(() => {});
  if (authStore.isLoggedIn) fetchHistory();
});

onUnmounted(() => ctx?.revert());

function scoreColor(score: number | null): string {
  if (score === null) return "var(--font-color)";
  if (score >= 80) return "var(--score-high)";
  if (score >= 60) return "var(--score-medium)";
  if (score >= 40) return "var(--score-low)";
  return "var(--score-critical)";
}

function animateScore(newScore: number | null) {
  if (newScore === null) return;
  ctx.add(() => {
    gsap.to(displayScore, {
      duration: 0.6,
      value: newScore,
      roundProps: "value",
      ease: "power2.out",
    });

    const el = document.querySelector(".score-value") as HTMLElement | null;
    if (!el) return;

    if (newScore >= 80) {
      gsap.fromTo(
        el,
        { scale: 1 },
        {
          scale: 1.15,
          duration: 0.3,
          yoyo: true,
          repeat: 3,
          ease: "power1.inOut",
        },
      );
    } else if (newScore >= 60) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    } else if (newScore >= 40) {
      gsap.fromTo(
        el,
        { x: 0 },
        { x: 6, duration: 0.07, yoyo: true, repeat: 5, ease: "none" },
      );
    } else if (newScore >= 20) {
      gsap.fromTo(
        el,
        { x: 0 },
        { x: 10, duration: 0.06, yoyo: true, repeat: 7, ease: "none" },
      );
    } else {
      gsap.fromTo(
        el,
        { x: 0 },
        { x: 14, duration: 0.05, yoyo: true, repeat: 10, ease: "none" },
      );
    }
  });
}

async function handleSubmit() {
  submitError.value = "";
  guestEmailError.value = "";

  const foods = [
    slot1.value.trim(),
    slot2.value.trim(),
    slot3.value.trim(),
  ].filter(Boolean);
  if (foods.length === 0) return;

  if (!authStore.isLoggedIn) {
    if (!guestEmail.value.trim()) {
      guestEmailError.value = "請輸入 Email 以儲存紀錄";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.value)) {
      guestEmailError.value = "Email 格式不正確";
      return;
    }
  }

  isSubmitting.value = true;
  correctionError.value = "";
  try {
    const errorMessage = await submitFoods(foods);
    if (errorMessage) {
      submitError.value = errorMessage;
      return;
    }

    slot1.value = "";
    slot2.value = "";
    slot3.value = "";
  } finally {
    isSubmitting.value = false;
  }
}

// 送出食物清單並套用回傳的評分結果；成功回傳 null，失敗回傳錯誤訊息
async function submitFoods(foods: string[]): Promise<string | null> {
  const email = authStore.isLoggedIn
    ? authStore.user!.email
    : guestEmail.value.trim();

  const fetchFn = authStore.isLoggedIn ? fetchWithAuth : fetch.bind(window);
  const res = await fetchFn(apiUrl("/api/meals"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, foods }),
  });
  if (!res.ok) return readApiError(res, "提交失敗，請再試一次");

  const data = await res.json();
  scoreResult.value = data.analysis;
  lastSubmittedFoods.value = foods;
  currentRecordId.value = data.record?.id ?? null;
  animateScore(data.analysis.totalScore);

  if (authStore.isLoggedIn && data.analysis.totalScore !== null) {
    const newRecord: IMealRecord = {
      id: data.record?.id ?? String(Date.now()),
      totalScore: data.analysis.totalScore,
      tips: data.analysis.tips,
      recordedAt: new Date().toISOString(),
      foodItems: data.record?.foodItems ?? [],
    };
    prependRecord(newRecord);
  }
  return null;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const err: Partial<IApiErrorResponse> = await res.json().catch(() => ({}));
  return err.details?.[0]?.message ?? err.error ?? fallback;
}

// 使用者修正某一口的食物類別：後端重算當餐分數並記住這個選擇
async function handleTypeChange(slot: number, type: BackendFoodType) {
  if (isCorrecting.value || isSubmitting.value) return;

  correctionError.value = "";
  isCorrecting.value = true;
  try {
    const recordId = currentRecordId.value;
    if (recordId) {
      const body: IUpdateFoodTypeRequest = { type };
      const res = await fetchWithAuth(
        apiUrl(`/api/meals/${recordId}/items/${slot - 1}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        correctionError.value = await readApiError(
          res,
          "修正分類失敗，請再試一次",
        );
        return;
      }
      const data: IFoodTypeCorrectionResponse = await res.json();
      scoreResult.value = data.analysis;
      if (data.record) {
        updateRecord(data.record);
      } else {
        removeRecord(recordId);
        currentRecordId.value = null;
      }
      animateScore(data.analysis.totalScore);
      return;
    }

    // 當餐全為「其他」時沒有寫入紀錄可修改：先存下個人分類，再以相同食物重送一次
    const label = lastSubmittedFoods.value[slot - 1];
    if (!label) return;
    const body: IUpsertFoodOverrideRequest = { label, type };
    const res = await fetchWithAuth(apiUrl("/api/food-overrides"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      correctionError.value = await readApiError(
        res,
        "修正分類失敗，請再試一次",
      );
      return;
    }
    const errorMessage = await submitFoods(lastSubmittedFoods.value);
    if (errorMessage) correctionError.value = errorMessage;
  } catch {
    correctionError.value = "網路錯誤，請確認連線後重試";
  } finally {
    isCorrecting.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SLOT_CHARS: Record<number, string> = { 1: "一", 2: "二", 3: "三" };
function numToChinese(n: number): string {
  return SLOT_CHARS[n] ?? String(n);
}
</script>

<template>
  <div class="home-page">
    <!-- 輸入區 -->
    <section class="input-section">
      <h3>記錄本餐進食順序</h3>

      <!-- 訪客 email 輸入 -->
      <div v-if="!authStore.isLoggedIn" class="slot">
        <label>輸入 Email，即可開始試用。</label>
        <input
          v-model="guestEmail"
          type="email"
          placeholder="example@email.com"
          data-testid="guest-email"
        />
        <p v-if="guestEmailError" class="error">{{ guestEmailError }}</p>
      </div>

      <div class="slots">
        <div class="slot">
          <label>第一口</label>
          <input
            v-model="slot1"
            type="text"
            placeholder="輸入食物名稱"
            data-testid="food-input-1"
          />
        </div>
        <div class="slot" :class="{ locked: !slot2Enabled }">
          <label>第二口 <span v-if="!slot2Enabled">🔒</span></label>
          <input
            v-model="slot2"
            type="text"
            placeholder="輸入食物名稱"
            :disabled="!slot2Enabled"
            data-testid="food-input-2"
          />
        </div>
        <div class="slot" :class="{ locked: !slot3Enabled }">
          <label>第三口 <span v-if="!slot3Enabled">🔒</span></label>
          <input
            v-model="slot3"
            type="text"
            placeholder="輸入食物名稱"
            :disabled="!slot3Enabled"
            data-testid="food-input-3"
          />
        </div>
      </div>

      <p v-if="submitError" class="error">{{ submitError }}</p>

      <button
        class="submit-btn"
        @click="handleSubmit"
        :disabled="isSubmitting || isCorrecting || !slot1.trim()"
        data-testid="meal-submit"
      >
        {{ isSubmitting ? "計算中..." : "送出評分" }}
      </button>
    </section>

    <!-- 評分結果 -->
    <section v-if="scoreResult" class="result-section">
      <div
        class="score-card"
        :style="{ borderColor: scoreColor(scoreResult.totalScore) }"
      >
        <!-- 重算時沿用同一行顯示狀態，避免多一行文字推擠下方版面 -->
        <div
          class="score-label"
          :data-testid="isCorrecting ? 'correction-loading' : undefined"
        >
          {{ isCorrecting ? "重新計算中…" : "本餐評分" }}
        </div>
        <div
          class="score-value"
          :style="{ color: scoreColor(scoreResult.totalScore) }"
          data-testid="score-value"
        >
          {{ scoreResult.totalScore === null ? "—" : displayScore }}
        </div>
      </div>

      <div class="breakdown" v-if="scoreResult.breakdown.length > 0">
        <div
          v-for="b in scoreResult.breakdown"
          :key="b.slot"
          class="breakdown-row"
          :data-testid="`breakdown-row-${b.slot}`"
        >
          <span class="slot-label">第{{ numToChinese(b.slot) }}口</span>
          <span class="slot-food">{{ b.label ?? "（空）" }}</span>
          <span class="slot-right">
            <span v-if="b.isOther" class="tag-other">不計分</span>
            <FoodTypeEditor
              :type="b.type"
              :slot-number="b.slot"
              :editable="authStore.isLoggedIn"
              :disabled="isCorrecting || isSubmitting"
              @change="handleTypeChange(b.slot, $event)"
            />
          </span>
        </div>
      </div>

      <p
        v-if="!authStore.isLoggedIn && scoreResult.breakdown.length > 0"
        class="correction-hint"
        data-testid="guest-correction-hint"
      >
        分類不符合預期？登入後可修正分類
      </p>
      <p v-if="correctionError" class="error" data-testid="correction-error">
        {{ correctionError }}
      </p>

      <div
        class="tips"
        v-if="scoreResult.tips.length > 0"
        data-testid="meal-tips"
      >
        <h4>建議</h4>
        <ul>
          <li v-for="(tip, i) in scoreResult.tips" :key="i">{{ tip }}</li>
        </ul>
      </div>
    </section>

    <!-- 歷史紀錄（已登入） -->
    <section v-if="authStore.isLoggedIn" class="history-section">
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
        <div
          v-for="r in records"
          :key="r.id"
          class="record-card"
          data-testid="history-record"
        >
          <div class="record-header">
            <span class="record-date">{{ formatDate(r.recordedAt) }}</span>
            <span
              class="record-score"
              :style="{ color: scoreColor(r.totalScore) }"
              data-testid="history-record-score"
              >{{ r.totalScore }} 分</span
            >
          </div>
          <div class="record-foods">
            {{
              r.foodItems.map((f) => f.label).join(" → ") || "（無食物明細）"
            }}
          </div>
        </div>
      </div>
    </section>

    <!-- 未登入：評分結果出現後顯示註冊引導 -->
    <section v-else-if="scoreResult" class="guest-cta">
      <p class="cta-text">分數已儲存！登入後可查看完整歷史紀錄</p>
      <router-link to="/login" class="cta-btn">立即登入</router-link>
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

h2,
h3 {
  margin: 0 0 16px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
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

.slot input:focus {
  border-color: var(--accent);
}
.slot.locked input {
  opacity: 0.4;
  cursor: not-allowed;
}
.slot.locked label {
  opacity: 0.5;
}

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

.submit-btn:hover:not(:disabled) {
  opacity: 0.85;
}
.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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

/* 不可加 overflow: hidden，否則會裁掉 FoodTypeEditor 往下展開的浮層選單 */
.breakdown {
  background: var(--social-bg, #242424);
  border-radius: 10px;
}

.breakdown-row {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color, #333);
  gap: 12px;
}

.breakdown-row:last-child {
  border-bottom: none;
}

/* 用 min-width 而非 width：固定寬度剛好等於三個字時，加上全域 letter-spacing 會超出而換行 */
.slot-label {
  font-size: var(--f14);
  color: var(--font-color);
  min-width: 48px;
  flex-shrink: 0;
}
.slot-food {
  flex: 1;
  font-size: var(--f16);
}
.slot-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-shrink: 0;
  min-width: 96px;
}

.tag-other {
  font-size: var(--f14);
  padding: 2px 8px;
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
  border-radius: 999px;
  white-space: nowrap;
}

.correction-hint {
  margin: 0;
  font-size: var(--f14);
  color: var(--font-color);
  text-align: right;
}

.tips {
  background: rgba(250, 204, 21, 0.08);
  border-left: 4px solid var(--score-medium);
  border-radius: 8px;
  padding: 14px 16px;
}

.tips h4 {
  margin: 0 0 8px;
  color: var(--score-medium);
  font-size: var(--f16);
}
.tips ul {
  margin: 0;
  padding-left: 18px;
}
.tips li {
  font-size: var(--f16);
  color: var(--score-medium);
  margin-bottom: 4px;
  text-align: left;
}

.history-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.skeleton {
  height: 64px;
  background: var(--social-bg, #242424);
  border-radius: 10px;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
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
  color: var(--color-danger);
  font-size: var(--f16);
  margin: 0;
}

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

.retry-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}

.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  color: var(--font-color);
}

.empty-icon {
  font-size: 2.4rem;
  margin: 0;
}

.empty-title {
  font-size: var(--f18);
  font-weight: 600;
  color: var(--font-color);
  margin: 0;
}

.empty-hint {
  font-size: var(--f14);
  color: var(--font-color);
  margin: 0;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

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

.record-date {
  font-size: var(--f14);
  color: var(--font-color);
}
.record-score {
  font-weight: 700;
  font-size: var(--f18);
}
.record-foods {
  font-size: var(--f16);
  color: var(--font-color);
}

.guest-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  background: rgba(var(--accent-rgb, 20, 184, 166), 0.08);
  border: 1px solid var(--accent);
  border-radius: 10px;
  text-align: center;
}

.cta-text {
  font-size: var(--f16);
  color: var(--font-color);
  margin: 0;
}

.cta-btn {
  display: inline-block;
  padding: 10px 24px;
  background: var(--accent);
  color: var(--font-color-h);
  border-radius: 8px;
  font-weight: 600;
  font-size: var(--f16);
  text-decoration: none;
  transition: opacity 0.2s;
}

.cta-btn:hover {
  opacity: 0.85;
}

@media (max-width: 1024px) {
  .home-page {
    padding: 24px 20px 48px;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .home-page {
    padding: 20px 16px 40px;
    gap: 20px;
  }
  .score-card {
    padding: 16px 20px;
  }
  .breakdown-row {
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .home-page {
    padding: 32px 12px;
    gap: 16px;
  }
  .input-section h3 {
    margin-bottom: 0;
  }
  .submit-btn {
    margin-top: 8px;
  }
  .slot-label {
    min-width: 36px;
  }
  .breakdown-row {
    flex-wrap: wrap;
  }
  .history-section {
    margin-top: 16px;
  }
  .record-card {
    padding: 10px 12px;
  }
}
</style>
