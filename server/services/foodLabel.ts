export const MAX_FOOD_LABEL_LENGTH = 100;

// 食物名稱作為 FoodDictionary 與 UserFoodOverride 的查詢鍵前先正規化：
// NFKC 統一全形／半形（「ＡＢＣ」→「ABC」），大小寫差異由 MySQL 的 ci collation 處理
export function normalizeLabel(label: string): string {
  return label.normalize("NFKC").trim();
}
