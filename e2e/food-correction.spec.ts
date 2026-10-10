import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  E2E_FOODS,
  E2E_GUEST_EMAIL,
  E2E_TEST_EMAIL,
  E2E_TEST_PASSWORD,
  resetE2ETestUser,
  seedE2EFoodDictionary,
} from './testAccount';

type FoodTypeName = 'FIBER' | 'PROTEIN' | 'COMPLEX_CARB' | 'SIMPLE_CARB' | 'OTHER';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(E2E_TEST_EMAIL);
  await page.getByTestId('login-password').fill(E2E_TEST_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL('/');
}

async function submitMeal(page: Page, foods: string[]): Promise<void> {
  for (const [index, food] of foods.entries()) {
    await page.getByTestId(`food-input-${index + 1}`).fill(food);
  }
  await page.getByTestId('meal-submit').click();
}

async function correctType(page: Page, slot: number, type: FoodTypeName): Promise<void> {
  await page.getByTestId(`food-type-edit-${slot}`).click();
  await page.getByTestId(`food-type-option-${slot}-${type}`).click();
}

// 元素上緣相對於分數卡的垂直距離。不直接比對 boundingBox().y：它相對於視窗，
// Playwright 點擊前自動捲動頁面就會改變數值，無法分辨是捲動還是版面被推擠
async function offsetFromScore(page: Page, locator: Locator): Promise<number> {
  const anchor = await page.getByTestId('score-value').boundingBox();
  const target = await locator.boundingBox();
  return target!.y - anchor!.y;
}

// 記錄修正分類會打的兩個端點，用來確認「取消」不會送出任何請求
function trackCorrectionRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (req) => {
    const isPatchMeal = req.method() === 'PATCH' && req.url().includes('/api/meals/');
    const isPutOverride = req.method() === 'PUT' && req.url().includes('/api/food-overrides');
    if (isPatchMeal || isPutOverride) requests.push(`${req.method()} ${req.url()}`);
  });
  return requests;
}

test.describe('修正食物分類', () => {
  test.beforeEach(async () => {
    // 個人覆寫與餐點紀錄隨帳號重建一併清空；字典固定測試食物的初始分類
    await resetE2ETestUser();
    await seedE2EFoodDictionary();
  });

  test('修正分類後重算分數並同步歷史紀錄，重新整理後仍保留', async ({ page }) => {
    await login(page);
    await submitMeal(page, [E2E_FOODS.simpleCarb]);

    await expect(page.getByTestId('food-type-label-1')).toHaveText('精緻碳水');
    await expect(page.getByTestId('score-value')).toHaveText('20');
    // 預設不顯示選單，點了編輯圖示才出現
    await expect(page.getByTestId('food-type-menu-1')).toHaveCount(0);

    await correctType(page, 1, 'PROTEIN');

    await expect(page.getByTestId('food-type-menu-1')).toHaveCount(0);
    await expect(page.getByTestId('food-type-label-1')).toHaveText('蛋白質');
    await expect(page.getByTestId('score-value')).toHaveText('60');
    await expect(page.getByTestId('history-record')).toHaveCount(1);
    await expect(page.getByTestId('history-record-score').first()).toHaveText('60 分');

    await page.reload();
    await expect(page.getByTestId('history-record')).toHaveCount(1);
    await expect(page.getByTestId('history-record-score').first()).toHaveText('60 分');
  });

  test('修正過的分類會套用到之後送出的同一食物', async ({ page }) => {
    await login(page);
    await submitMeal(page, [E2E_FOODS.simpleCarb]);
    await expect(page.getByTestId('score-value')).toHaveText('20');
    await correctType(page, 1, 'PROTEIN');
    await expect(page.getByTestId('score-value')).toHaveText('60');

    await submitMeal(page, [E2E_FOODS.simpleCarb]);

    await expect(page.getByTestId('history-record')).toHaveCount(2);
    await expect(page.getByTestId('food-type-label-1')).toHaveText('蛋白質');
    await expect(page.getByTestId('score-value')).toHaveText('60');
    await expect(page.getByTestId('history-record-score').first()).toHaveText('60 分');
  });

  test('按 Esc、點選單外或選原本的類別只會收合，不送出請求', async ({ page }) => {
    const requests = trackCorrectionRequests(page);
    await login(page);
    await submitMeal(page, [E2E_FOODS.simpleCarb]);
    await expect(page.getByTestId('score-value')).toHaveText('20');

    const menu = page.getByTestId('food-type-menu-1');

    await page.getByTestId('food-type-edit-1').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    await page.getByTestId('food-type-edit-1').click();
    await expect(menu).toBeVisible();
    await page.getByTestId('score-value').click();
    await expect(menu).toHaveCount(0);

    await correctType(page, 1, 'SIMPLE_CARB');
    await expect(menu).toHaveCount(0);

    await expect(page.getByTestId('food-type-label-1')).toHaveText('精緻碳水');
    await expect(page.getByTestId('score-value')).toHaveText('20');
    expect(requests).toEqual([]);
  });

  test('選單以浮層顯示：不推擠其他元件，最後一列的選單不被裁切', async ({ page }) => {
    await login(page);
    await submitMeal(page, [E2E_FOODS.fiber, E2E_FOODS.simpleCarb, E2E_FOODS.other]);
    await expect(page.getByTestId('score-value')).toHaveText('70');

    const lastRow = page.getByTestId('breakdown-row-3');
    const tips = page.getByTestId('meal-tips');
    const lastRowBefore = await offsetFromScore(page, lastRow);
    const tipsBefore = await offsetFromScore(page, tips);

    await page.getByTestId('food-type-edit-2').click();
    await expect(page.getByTestId('food-type-menu-2')).toBeVisible();
    expect(await offsetFromScore(page, lastRow)).toBeCloseTo(lastRowBefore, 1);
    expect(await offsetFromScore(page, tips)).toBeCloseTo(tipsBefore, 1);

    // 開另一列時，前一列的選單會收合（同一時間只有一個選單）。
    // 點第一口而非第三口：第二口的選單往下展開，會蓋住第三口的編輯圖示
    await page.getByTestId('food-type-edit-1').click();
    await expect(page.getByTestId('food-type-menu-2')).toHaveCount(0);
    await expect(page.getByTestId('food-type-menu-1')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('food-type-edit-3').click();
    const lastMenu = page.getByTestId('food-type-menu-3');
    await expect(lastMenu).toBeVisible();
    expect(await offsetFromScore(page, tips)).toBeCloseTo(tipsBefore, 1);

    // 選單超出明細區塊下緣、蓋在建議區塊上；trial click 會確認該處真的點得到選項（沒被裁切或遮住）
    const menuBox = await lastMenu.boundingBox();
    const tipsBox = await tips.boundingBox();
    expect(menuBox!.y + menuBox!.height).toBeGreaterThan(tipsBox!.y);
    await page.getByTestId('food-type-option-3-OTHER').click({ trial: true });
  });

  test('全為「其他」的餐點沒有紀錄，修正後才建立', async ({ page }) => {
    await login(page);
    await submitMeal(page, [E2E_FOODS.other]);

    await expect(page.getByTestId('food-type-label-1')).toHaveText('其他');
    await expect(page.getByTestId('score-value')).toHaveText('—');
    await expect(page.getByTestId('history-record')).toHaveCount(0);

    await correctType(page, 1, 'PROTEIN');

    await expect(page.getByTestId('food-type-label-1')).toHaveText('蛋白質');
    await expect(page.getByTestId('score-value')).toHaveText('60');
    await expect(page.getByTestId('history-record')).toHaveCount(1);
  });

  test('全部改成「其他」後移除紀錄，之後仍可再改回來', async ({ page }) => {
    await login(page);
    await submitMeal(page, [E2E_FOODS.simpleCarb]);
    await expect(page.getByTestId('history-record')).toHaveCount(1);

    await correctType(page, 1, 'OTHER');
    await expect(page.getByTestId('score-value')).toHaveText('—');
    await expect(page.getByTestId('history-record')).toHaveCount(0);

    await correctType(page, 1, 'FIBER');
    await expect(page.getByTestId('food-type-label-1')).toHaveText('膳食纖維');
    await expect(page.getByTestId('score-value')).toHaveText('60');
    await expect(page.getByTestId('history-record')).toHaveCount(1);
  });

  test('訪客看不到編輯圖示，改顯示登入提示', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('guest-email').fill(E2E_GUEST_EMAIL);
    await submitMeal(page, [E2E_FOODS.simpleCarb]);

    await expect(page.getByTestId('food-type-label-1')).toHaveText('精緻碳水');
    await expect(page.getByTestId('food-type-edit-1')).toHaveCount(0);
    await expect(page.getByTestId('guest-correction-hint')).toBeVisible();
  });
});
