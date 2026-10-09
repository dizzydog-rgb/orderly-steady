import { disconnectE2EPrisma } from './testAccount';

export default async function globalTeardown(): Promise<void> {
  await disconnectE2EPrisma();
}
