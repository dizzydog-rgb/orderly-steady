<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  type TooltipItem,
  type Chart,
} from 'chart.js';
import gsap from 'gsap';
import type { IMealRecord } from '../types';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

const props = defineProps<{ records: IMealRecord[] }>();

const RANGE_OPTIONS = [
  { label: '當日',  days: 0   },
  { label: '7天',   days: 7   },
  { label: '14天',  days: 14  },
  { label: '30天',  days: 30  },
  { label: '3個月', days: 90  },
  { label: '半年',  days: 180 },
] as const;

// 每個時間範圍的標籤間隔（天）：7天每1天、14/30天每7天、90/180天每月
const LABEL_INTERVAL_DAYS: Record<number, number> = {
  7: 1,
  14: 7,
  30: 7,
  90: 30,
  180: 30,
};

const selectedDays = ref(7);
const isTransitioning = ref(false);
const chartWrapper = ref<HTMLElement | null>(null);
let ctx: gsap.Context;

const filteredRecords = computed(() => {
  if (selectedDays.value === 0) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return props.records.filter(r => new Date(r.recordedAt).getTime() >= midnight.getTime());
  }
  const intervalDays = LABEL_INTERVAL_DAYS[selectedDays.value] ?? 1;
  const numBuckets = Math.round(selectedDays.value / intervalDays);
  const cutoff = Date.now() - numBuckets * intervalDays * 86_400_000;
  return props.records.filter(r => new Date(r.recordedAt).getTime() >= cutoff);
});

function getCssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const backgroundBandsPlugin = {
  id: 'backgroundBands',
  beforeDatasetsDraw(chart: Chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const yScale = scales['y'];
    const bands = [
      { min: 80, max: 100, color: 'rgba(74,222,128,0.12)'  },
      { min: 60, max: 80,  color: 'rgba(250,204,21,0.10)'  },
      { min: 40, max: 60,  color: 'rgba(251,146,60,0.10)'  },
      { min: 20, max: 40,  color: 'rgba(248,113,113,0.10)' },
      { min: 0,  max: 20,  color: 'rgba(239,68,68,0.15)'   },
    ];
    ctx.save();
    for (const band of bands) {
      const yTop    = yScale.getPixelForValue(band.max);
      const yBottom = yScale.getPixelForValue(band.min);
      ctx.fillStyle = band.color;
      ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBottom - yTop);
    }
    ctx.restore();
  },
};

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const chartData = computed(() => {
  const recs = filteredRecords.value;

  // 當日模式：每筆記錄各自顯示，X 軸為時間
  if (selectedDays.value === 0) {
    const sorted = [...recs].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    return {
      labels: sorted.map(r => formatTimeOnly(r.recordedAt)),
      datasets: [
        {
          data: sorted.map(r => r.totalScore),
          spanGaps: false,
          borderColor: getCssVar('--accent', '#66bab7'),
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: 'origin',
          backgroundColor: getCssVar('--accent-bg', 'rgba(102,186,183,0.12)'),
          tension: 0.35,
          clip: false as const,
        },
      ],
    };
  }

  const now = Date.now();
  const intervalDays = LABEL_INTERVAL_DAYS[selectedDays.value] ?? 1;
  const intervalMs = intervalDays * 86_400_000;
  const numBuckets = Math.round(selectedDays.value / intervalDays);

  type Bucket = { label: string; score: number | null };

  // k=0 最舊（最左），k=numBuckets-1 最新（最右 = 今天）
  const buckets: Bucket[] = Array.from({ length: numBuckets }, (_, k) => {
    const bucketEnd = now - (numBuckets - 1 - k) * intervalMs;
    const bucketStart = bucketEnd - intervalMs;
    const inBucket = recs.filter(r => {
      const ts = new Date(r.recordedAt).getTime();
      return ts >= bucketStart && ts < bucketEnd;
    });
    return {
      label: formatDateOnly(new Date(bucketEnd).toISOString()),
      score: inBucket.length > 0
        ? Math.round(inBucket.reduce((sum, r) => sum + r.totalScore, 0) / inBucket.length)
        : null,
    };
  });

  return {
    labels: buckets.map(b => b.label),
    datasets: [
      {
        data: buckets.map(b => b.score),
        spanGaps: true,
        borderColor: getCssVar('--accent', '#66bab7'),
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: 'origin',
        backgroundColor: getCssVar('--accent-bg', 'rgba(102,186,183,0.12)'),
        tension: 0.35,
        clip: false as const,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  layout: { padding: { top: 12, bottom: 8 } },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: { stepSize: 20, color: getCssVar('--font-color', '#999') },
      grid: { color: 'rgba(128,128,128,0.15)' },
    },
    x: {
      ticks: {
        color: getCssVar('--font-color', '#999'),
        maxRotation: 30,
        autoSkip: false,
      },
      grid: { display: false },
    },
  },
  plugins: {
    tooltip: { callbacks: { label: (item: TooltipItem<'line'>) => `${item.parsed.y} 分` } },
    legend: { display: false },
  },
}));

async function selectRange(days: number) {
  if (days === selectedDays.value || isTransitioning.value) return;
  isTransitioning.value = true;
  if (chartWrapper.value) {
    await gsap.to(chartWrapper.value, { opacity: 0, duration: 0.15, ease: 'power1.in' });
  }
  selectedDays.value = days;
  await nextTick();
  if (chartWrapper.value) {
    await gsap.to(chartWrapper.value, { opacity: 1, duration: 0.3, ease: 'power1.out' });
  }
  isTransitioning.value = false;
}

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.fromTo(
      chartWrapper.value,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
    );
  });
});

onUnmounted(() => ctx?.revert());
</script>

<template>
  <div class="score-trend-chart" ref="chartWrapper">
    <div class="range-selector">
      <button
        v-for="opt in RANGE_OPTIONS"
        :key="opt.days"
        class="range-btn"
        :class="{ active: selectedDays === opt.days }"
        :disabled="isTransitioning"
        @click="selectRange(opt.days)"
      >{{ opt.label }}</button>
    </div>

    <div class="chart-area">
      <Line
        v-if="filteredRecords.length > 0"
        :data="chartData"
        :options="chartOptions"
        :plugins="[backgroundBandsPlugin]"
      />
      <p v-else class="chart-empty-hint">
        此時間範圍內無紀錄
      </p>
    </div>
  </div>
</template>

<style scoped>
.score-trend-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 100%;
  overflow: hidden;
}

.range-selector {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.range-btn {
  padding: 5px 12px;
  font-size: var(--f14);
  border: 1px solid var(--border-color, #444);
  border-radius: 999px;
  background: none;
  color: var(--font-color);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.range-btn:hover:not(:disabled):not(.active) {
  border-color: var(--accent);
  color: var(--accent);
}

.range-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--font-color-h, #fff);
}

.range-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chart-area {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  box-sizing: border-box;
}

.chart-empty-hint {
  font-size: var(--f14);
  color: var(--font-color);
  text-align: center;
  margin: 0;
}

@media (max-width: 480px) {
  .range-btn { padding: 4px 10px; font-size: var(--f14); }
  .chart-area { height: 170px; }
}
</style>
