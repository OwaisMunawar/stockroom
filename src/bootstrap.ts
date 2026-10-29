import { requireOptionalNativeModule } from 'expo';
import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { WarehouseAuthority } from '../shared/authority';
import { sampleCatalog } from '../shared/catalog';
import { InventoryController } from './features/counts/application/controller';
import { ClientRepository } from './features/counts/data/clientRepository';
import { ExpoDatabase } from './features/counts/data/expoDatabase';
import { HttpTransport } from './features/counts/data/httpTransport';
import {
  type NativeCountModule,
  OnDeviceParser,
  RulesParser,
} from './features/counts/data/draftParser';

export async function openInventory(): Promise<InventoryController> {
  const deterministic = process.env.EXPO_PUBLIC_DEMO === '1';
  const origin = deterministic ? undefined : process.env.EXPO_PUBLIC_SYNC_ORIGIN;
  const mode = origin ? 'http' : 'demo';
  const database = await openDatabaseAsync(
    mode === 'demo' ? 'stockroom-demo.db' : 'stockroom-client.db',
  );
  await database.execAsync('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  const driver = new ExpoDatabase(database);
  const clock = (): string => new Date().toISOString();
  const repository = new ClientRepository(driver, clock);
  await repository.initialize(sampleCatalog);
  const demo = new WarehouseAuthority(driver, 'demo', clock);
  if (mode === 'demo') await demo.initialize(sampleCatalog);
  const module = deterministic
    ? null
    : requireOptionalNativeModule<NativeCountModule>('StockroomIntelligence');
  const controller = new InventoryController({
    repository,
    transport: origin ? new HttpTransport(origin) : demo,
    rules: new RulesParser(),
    model: module?.available() ? new OnDeviceParser(module) : null,
    now: () => new Date(),
    id: () => randomUUID(),
    mode,
  });
  await controller.load();
  return controller;
}
