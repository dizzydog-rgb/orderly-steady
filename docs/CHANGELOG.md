# Changelog

所有對「控糖網站」專案的重要變更都將記錄在此文件中。

## [0.2.0] - 2026-05-03

### Added
- **全端架構**: 建立 Node.js (Express) 後端服務、Prisma ORM 配置與 Docker 容器化資料庫設定。
- **健康建議系統**: 在 `scoringAlgorithm.ts` 中實作智慧飲食建議 (Tips) 邏輯。
- **動態視覺回饋**: 整合 GSAP 實作分數變動的數值滾動動畫，並加入自動清理機制。
- **UI 優化**: 新增健康建議提示框 (Tips Container)，並優化分數顏色回饋。

### Changed
- **架構重構**: 將前端評分狀態邏輯抽離至 `useGlucoseScore` composable。
- **測試更新**: 擴充單元測試以涵蓋 `tips` 邏輯。

## [0.1.0] - 2026-04-26

### Added
- 初始化專案架構。
- 建立 `docs/` 文件系統。
- 完成 `ARCHITECTURE.md`, `DEVELOPMENT.md`, `FEATURES.md`, `TESTING.md`。

---
*格式參考自 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).*
