import { test, expect, type Page } from '@playwright/test';
import {
  E2E_TEST_EMAIL,
  E2E_TEST_NAME,
  E2E_TEST_PASSWORD,
  resetE2ETestUser,
} from './testAccount';

const NEW_PASSWORD = 'E2eNewPass5678!';

async function login(page: Page, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(E2E_TEST_EMAIL);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}

test.describe('帳號設定', () => {
  test.beforeEach(async ({ page }) => {
    // 密碼變更案例會改掉密碼，每個 test 都從已知密碼與名稱的乾淨狀態開始
    await resetE2ETestUser();
    await login(page, E2E_TEST_PASSWORD);
    await expect(page).toHaveURL('/');
    await page.goto('/member/settings');
  });

  test('Email 只顯示不提供編輯', async ({ page }) => {
    await expect(page.getByTestId('settings-email')).toHaveText(E2E_TEST_EMAIL);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test('更新名稱成功後重新整理仍保留', async ({ page }) => {
    await expect(page.getByTestId('nickname-input')).toHaveValue(E2E_TEST_NAME);

    await page.getByTestId('nickname-input').fill('改過的名稱');
    await page.getByTestId('nickname-submit').click();
    await expect(page.getByTestId('nickname-success')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('nickname-input')).toHaveValue('改過的名稱');
  });

  test('名稱清空時被前端擋下且不送出請求', async ({ page }) => {
    let requested = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/me') && req.method() === 'PATCH') requested = true;
    });

    await page.getByTestId('nickname-input').fill('');
    await page.getByTestId('nickname-submit').click();

    await expect(page.getByTestId('nickname-success')).toHaveCount(0);
    expect(requested).toBe(false);
  });

  test('目前密碼錯誤時顯示錯誤訊息且不被強制登出', async ({ page }) => {
    await page.getByTestId('current-password-input').fill('WrongPassword123');
    await page.getByTestId('new-password-input').fill(NEW_PASSWORD);
    await page.getByTestId('confirm-password-input').fill(NEW_PASSWORD);
    await page.getByTestId('password-submit').click();

    await expect(page.getByTestId('password-error')).toHaveText('目前密碼不正確');
    await expect(page).toHaveURL('/member/settings');
  });

  test('兩次新密碼不一致時前端擋下且不送出請求', async ({ page }) => {
    let requested = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/password')) requested = true;
    });

    await page.getByTestId('current-password-input').fill(E2E_TEST_PASSWORD);
    await page.getByTestId('new-password-input').fill(NEW_PASSWORD);
    await page.getByTestId('confirm-password-input').fill(NEW_PASSWORD + 'x');
    await page.getByTestId('password-submit').click();

    await expect(page.getByTestId('password-error')).toHaveText('兩次輸入的新密碼不一致');
    expect(requested).toBe(false);
  });

  test('密碼變更成功後登出，舊密碼失效、新密碼可登入', async ({ page }) => {
    await page.getByTestId('current-password-input').fill(E2E_TEST_PASSWORD);
    await page.getByTestId('new-password-input').fill(NEW_PASSWORD);
    await page.getByTestId('confirm-password-input').fill(NEW_PASSWORD);
    await page.getByTestId('password-submit').click();

    await expect(page).toHaveURL('/login');

    await login(page, E2E_TEST_PASSWORD);
    await expect(page.getByText('帳號或密碼錯誤')).toBeVisible();

    await login(page, NEW_PASSWORD);
    await expect(page).toHaveURL('/');
  });
});
