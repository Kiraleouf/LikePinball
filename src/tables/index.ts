import type { TableDefinition } from './types';
import { TABLE_ZERO } from './table0';
import { TABLE_ONE } from './table1';

const TABLES: ReadonlyMap<number, TableDefinition> = new Map([
  [TABLE_ZERO.id, TABLE_ZERO],
  [TABLE_ONE.id, TABLE_ONE],
]);

export function getTable(id: number): TableDefinition {
  return TABLES.get(id) ?? TABLE_ZERO;
}
