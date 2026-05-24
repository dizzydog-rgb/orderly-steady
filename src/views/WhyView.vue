<script setup lang="ts">
import { computed } from 'vue';
import LangSwitcher from '../components/LangSwitcher.vue';
import { useLang } from '../composables/useLang';

const { lang } = useLang();

const content = computed(() => lang.value === 'cn' ? cn : en);

const cn = {
  title: '為什麼要控糖？',
  subtitle: '飲食順序，改變你的血糖命運',
  sections: [
    {
      heading: '吃什麼，不如怎麼吃',
      body: '現代人的飲食問題不只是「吃什麼」，更關鍵的是「怎麼吃」。研究顯示，進食順序對飯後血糖波動有顯著影響。先吃膳食纖維（蔬菜）、再吃蛋白質，最後才吃碳水化合物，可有效降低血糖峰值高達 40%。',
    },
    {
      heading: '血糖波動的隱藏代價',
      body: '血糖劇烈波動不只是糖尿病患者的問題。每次血糖快速飆升後的急速下降，都會帶來疲倦、注意力不集中，甚至是對高糖食物的渴望。長期下來，會增加胰島素阻抗的風險，悄悄影響整體健康。',
    },
    {
      heading: '我們的解法',
      body: 'Orderly & Steady 的設計理念很簡單：幫助你記錄每餐的進食順序，即時計算血糖穩定得分，讓你看見每個飲食決定的影響。這不是在限制你吃什麼，而是讓你知道怎麼吃更聰明。',
    },
  ],
};

const en = {
  title: 'Why Blood Sugar Control Matters',
  subtitle: 'The order you eat changes your blood sugar',
  sections: [
    {
      heading: 'It\'s Not What You Eat — It\'s How',
      body: 'The real question isn\'t just "what you eat" — it\'s "how you eat." Research shows that eating order significantly affects post-meal blood sugar spikes. Starting with fiber-rich vegetables, followed by protein, and ending with carbohydrates can reduce peak blood sugar levels by up to 40%.',
    },
    {
      heading: 'The Hidden Cost of Blood Sugar Spikes',
      body: 'Blood sugar spikes aren\'t just a concern for people with diabetes. Each rapid rise and crash leaves you feeling fatigued, unfocused, and craving more sugar. Over time, this pattern quietly increases the risk of insulin resistance and undermines your overall health.',
    },
    {
      heading: 'Our Approach',
      body: 'Orderly & Steady is built on a simple idea: help you record your eating order, calculate a blood sugar stability score in real time, and let you see the impact of every meal decision. It\'s not about restricting what you eat — it\'s about eating smarter.',
    },
  ],
};
</script>

<template>
  <div class="why-page">
    <div class="why-container">
      <div class="lang-bar">
        <LangSwitcher />
      </div>

      <header class="why-header">
        <h1 class="why-title">{{ content.title }}</h1>
        <p class="why-subtitle">{{ content.subtitle }}</p>
      </header>

      <article class="why-article">
        <section
          v-for="(section, i) in content.sections"
          :key="i"
          class="why-section"
        >
          <h2>{{ section.heading }}</h2>
          <p>{{ section.body }}</p>
        </section>
      </article>

      <footer class="why-footer">
        <router-link to="/" class="back-btn">← {{ lang === 'cn' ? '開始記錄' : 'Start Recording' }}</router-link>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.why-page {
  min-height: calc(100vh - 57px);
  display: flex;
  justify-content: center;
  padding: 48px 20px 80px;
}

.why-container {
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.lang-bar { display: flex; justify-content: flex-end; }

.why-header { text-align: center; }

.why-title {
  font-family: var(--font-sans);
  font-size: var(--f36);
  font-weight: 800;
  color: var(--font-color-h);
  margin: 0 0 10px;
  line-height: 1.2;
}

.why-subtitle {
  font-size: var(--f18);
  color: var(--accent);
  margin: 0;
  font-weight: 500;
}

.why-article { display: flex; flex-direction: column; gap: 28px; }

.why-section h2 {
  font-size: var(--f20);
  font-weight: 700;
  color: var(--font-color-h);
  margin: 0 0 10px;
  padding-left: 12px;
  border-left: 3px solid var(--accent);
}

.why-section p {
  font-size: var(--f16);
  color: var(--font-color);
  line-height: 1.8;
  margin: 0;
}

.why-footer { display: flex; justify-content: center; padding-top: 8px; }

.back-btn {
  display: inline-block;
  padding: 10px 28px;
  background: var(--accent);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-size: var(--f16);
  font-weight: 600;
  transition: opacity 0.2s;
}

.back-btn:hover { opacity: 0.85; }

@media (max-width: 1024px) {
  .why-page { padding: 36px 20px 60px; }
  .why-container { gap: 24px; }
}

@media (max-width: 768px) {
  .why-page { padding: 24px 20px 48px; }
  .why-container { max-width: 100%; }
  .lang-bar { justify-content: center; }
}

@media (max-width: 480px) {
  .why-page { padding: 20px 12px 40px; }
  .why-container { gap: 20px; }
  .why-header { text-align: left; }
}
</style>
