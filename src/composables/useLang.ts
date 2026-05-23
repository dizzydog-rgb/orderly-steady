import { ref, watchEffect } from 'vue';

export type Lang = 'cn' | 'en';

const saved = localStorage.getItem('lang');
const lang = ref<Lang>(saved === 'en' ? 'en' : 'cn');

watchEffect(() => {
  localStorage.setItem('lang', lang.value);
});

export function useLang() {
  function setLang(l: Lang) {
    lang.value = l;
  }
  return { lang, setLang };
}
