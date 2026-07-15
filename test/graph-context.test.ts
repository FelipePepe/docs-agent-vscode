import { describe, expect, it } from 'vitest';
import { buildGraphContextForDoc, type ArchitectureData } from '../src/graph-context';
import type { CbmManager, CbmQueryResult } from '../src/cbm-runner';

function stubCbm(onQuery?: (cypher: string) => Promise<CbmQueryResult>): CbmManager {
  return {
    queryGraph: onQuery ?? (async () => ({ rows: [], total: 0 })),
  } as unknown as CbmManager;
}

const arch: ArchitectureData = {
  total_nodes:  10,
  packages:     [{ name: 'core', node_count: 5, fan_in: 2, fan_out: 1 }],
  layers:       [{ name: 'core', layer: 'core', reason: 'high fan-in' }],
  entry_points: [{ name: 'activate', qualified_name: 'ext.activate', file: 'src/extension.ts' }],
  file_tree:    [{ path: 'src', type: 'dir', children: 1 }],
};

describe('buildGraphContextForDoc', () => {
  it('scopes api-reference to entry_points + a public-surface query, excluding file_tree', async () => {
    const cbm = stubCbm(async (cypher) => {
      if (cypher.includes('IMPLEMENTS')) {
        return { rows: [{ implementor: 'Foo', contract: 'IFoo' }], total: 1 };
      }
      return { rows: [{ qn: 'IFoo', name: 'IFoo', file: 'src/foo.ts' }], total: 1 };
    });

    const out = await buildGraphContextForDoc(arch, cbm, 'api-reference');

    expect(out).toContain('entry_points');
    expect(out).toContain('IFoo');
    expect(out).not.toContain('file_tree');
    expect(out).not.toContain('packages');
  });

  it('returns an empty block for data-model on a graph with no table edges, without throwing', async () => {
    const cbm = stubCbm(async () => ({ rows: [], total: 0 }));
    const out = await buildGraphContextForDoc(arch, cbm, 'data-model');
    expect(out).toBe('');
  });

  it('falls back to the default profile for an unlisted doc id', async () => {
    const cbm = stubCbm();
    const out = await buildGraphContextForDoc(arch, cbm, 'some-unknown-doc-type');
    expect(out).toContain('packages');
    expect(out).toContain('layers');
    expect(out).toContain('entry_points');
  });

  it('degrades to an empty string when the targeted query throws', async () => {
    const cbm = stubCbm(async () => { throw new Error('cypher subset unsupported'); });
    const out = await buildGraphContextForDoc({}, cbm, 'api-reference');
    expect(out).toBe('');
  });
});
