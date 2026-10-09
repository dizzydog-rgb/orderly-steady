import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3100',
    },
  },
  test: {
    environment: 'happy-dom',
    // e2e/ 由 Playwright 執行，避免被 Vitest 當成單元測試抓進來
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
