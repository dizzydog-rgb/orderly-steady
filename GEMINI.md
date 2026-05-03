# GlucoseFlow - High-Performance Management System

## 📌 專案概述
一個結合 AI 分類邏輯的控糖管理系統。使用者紀錄進食順序（例如：菜 -> 肉 -> 飯），系統計算血糖穩定得分並進行數據視覺化。

- **前端**: Vue 3 (Composition API), Vite, TypeScript, Pinia, GSAP
- **後端**: Node.js (Express), MySQL (Sequelize/Prisma), Docker
- **核心邏輯**: 基於「進食順序」的演算法評分系統。

## 🎯 核心目標 (Core Objectives)
1. **資料穩定性**: 遵循 RESTful API 規範與 EJS 模板架構，確保資料的正確性與穩定性。
2. **查詢效能優化**: 提升歷史資料的讀取速率，讓使用者在回顧過往紀錄時能即時獲得結果。
3. **動態視覺回饋**: 透過視覺化圖表呈現得分趨勢，並根據不同分數級距給予專屬的動畫效果，增強互動體驗。

## 🛡️ 執行準則 (Execution Guidelines)
1. **查詢速率優化**:
   - 後端需針對高頻查詢條件（如：使用者 ID、時間範圍）建立資料庫索引 (Index)。
   - 前端利用 Pinia 快取已拉取過的歷史紀錄，避免重複發起請求。
2. **視覺化圖表整合**:
   - 使用 Chart.js (搭配 vue-chartjs) 繪製分數趨勢圖，且必須實作資料載入時的 Loading 狀態。
3. **差異化 GSAP 動畫**: 根據評分結果實作不同動畫，且必須依賴 `onMounted` 觸發，並透過 `gsap.context()` 正確清理。
   - **80+ (優良)**: 輕快、正向的彈跳與綠色高光動畫。
   - **60-79 (良好)**: 溫和的淡入與綠色提示。
   - **40-59 (普通)**: 輕微震動與黃綠色強調。
   - **20-39 (不佳)**: 明顯震動與橘色警告。
   - **<20 (極差)**: 強烈震動、閃爍與紅色嚴重警告。

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