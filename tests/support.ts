import { sampleCatalog } from '../shared/catalog';
import { makeCommand, parseWithRules } from '../shared/counts';
import { WarehouseAuthority } from '../shared/authority';
import { NodeSqlite } from '../server/sqlite';
import { ClientRepository } from '../src/features/counts/data/clientRepository';

export const time = '2026-10-29T09:00:00.000Z';
export const product = sampleCatalog[0]!;
export const command = (id = 'count-one', quantity = 14, baseVersion = 1) => ({
  ...makeCommand(parseWithRules(`${quantity} brass adapters in bin B2`, sampleCatalog), id, time),
  baseVersion,
});
export async function fixture() {
  const local = new NodeSqlite(':memory:');
  const remote = new NodeSqlite(':memory:');
  const repository = new ClientRepository(local, () => time);
  await repository.initialize(sampleCatalog);
  const authority = new WarehouseAuthority(remote, 'server', () => time);
  await authority.initialize(sampleCatalog);
  return {
    local,
    remote,
    repository,
    authority,
    close: () => {
      local.close();
      remote.close();
    },
  };
}
