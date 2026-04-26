# GlucoseFlow - High-Performance Management System

## 📌 專案概述
一個結合 AI 分類邏輯的控糖管理系統。使用者紀錄進食順序（例如：菜 -> 肉 -> 飯），系統計算血糖穩定得分並進行數據視覺化。

- **前端**: Vue 3 (Composition API), Vite, TypeScript, Pinia, GSAP
- **後端**: Node.js (Express), MySQL (Sequelize/Prisma), Docker
- **核心邏輯**: 基於「進食順序」的演算法評分系統。

## 🛠 常用指令
- `npm run dev`: 啟動前端開發環境
- `docker-compose up -d`: 啟動資料庫與後端服務
- `npm run lint`: 執行程式碼檢查

## ⚖️ 關鍵規則 (Critical Rules)
1. **型別安全**: 嚴格禁止使用 `any`，所有 API 回傳與組件 Props 必須定義 Interface。
2. **組件化設計**: 遵循「單一職責原則」，UI 組件與邏輯組件分離。
3. **性能優化**: 
   - 串接 AI API 時必須實作 Loading State。
   - 搜尋或高頻輸入需使用 Debounce (防抖)。
4. **GSAP 動畫**: 
   - 僅在 `onMounted` 週期觸發。
   - 使用 `Context` 進行清理，避免內存洩漏。

## 📚 @docs 引用
- [Vue3 Docs](https://vuejs.org/)
- [Pinia Docs](https://pinia.vuejs.org/)
- [GSAP Docs](https://gsap.com/docs/v3/)
- [Dietary Logic]: 蔬菜(Fiber) -> 蛋白質(Protein) -> 澱粉(Carb) 為最佳順序。