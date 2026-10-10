import { disconnectE2EPrisma, removeE2EFoodDictionary } from './testAccount';

export default async function globalTeardown(): Promise<void> {
  await removeE2EFoodDictionary();
  await disconnectE2EPrisma();
}
