import { describe, expect, it } from 'vitest';
import { CbmManager } from '../src/cbm-runner';
import type { McpClient } from '../src/mcp-client';

function stubClient(onCallTool: (name: string, args: Record<string, unknown>) => Promise<string>): McpClient {
  return { callTool: onCallTool } as unknown as McpClient;
}

describe('CbmManager.indexStatus', () => {
  it('reports indexed when CBM returns status "ready"', async () => {
    const mgr = new CbmManager(
      stubClient(async () => JSON.stringify({ status: 'ready', nodes: 100, edges: 200 })),
      '/ws',
    );
    expect(await mgr.indexStatus()).toEqual({ indexed: true, status: 'ready' });
  });

  it('reports not indexed for any non-"ready" status', async () => {
    const mgr = new CbmManager(
      stubClient(async () => JSON.stringify({ status: 'indexing' })),
      '/ws',
    );
    expect(await mgr.indexStatus()).toEqual({ indexed: false, status: 'indexing' });
  });

  it('reports not indexed when the project has never been indexed (CBM throws)', async () => {
    const mgr = new CbmManager(
      stubClient(async () => { throw new Error('project not found or not indexed'); }),
      '/ws',
    );
    expect(await mgr.indexStatus()).toEqual({ indexed: false });
  });
});
