import { resetE2ETestUser } from './testAccount';

export default async function globalSetup(): Promise<void> {
  await resetE2ETestUser();
}
