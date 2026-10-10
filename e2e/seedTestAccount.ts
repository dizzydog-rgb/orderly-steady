// 手動重置 E2E 測試帳號：npm run seed:e2e
import { resetE2ETestUser, disconnectE2EPrisma, E2E_TEST_EMAIL, E2E_TEST_PASSWORD } from './testAccount';

resetE2ETestUser()
  .then(() => {
    console.log('E2E 測試帳號已重建：');
    console.log('  Email   : ' + E2E_TEST_EMAIL);
    console.log('  Password: ' + E2E_TEST_PASSWORD);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => disconnectE2EPrisma());
