import { beforeEach, describe, expect, it } from 'vitest';
import { registerChatParticipant } from '../src/chat-participant';
import { CodeGraph } from '../src/graph';
import { __getExecuteCommandCalls, __resetExecuteCommand } from './mocks/vscode';
import type * as vscode from 'vscode';

function sampleGraph(): CodeGraph {
  const g = new CodeGraph();
  g.addNode({ symbol: 'OrderService', label: 'OrderService', file: '/ws/OrderService.java', line: 5, kind: 'interface' });
  g.addNode({ symbol: 'OrderServiceImpl', label: 'OrderServiceImpl', file: '/ws/OrderServiceImpl.java', line: 8, kind: 'class' });
  g.addNode({ symbol: 'OrderController.create', label: '.create()', file: '/ws/OrderController.java', line: 21, kind: 'method' });
  g.addCallEdge({ caller: 'OrderController.create', callerFile: '/ws/OrderController.java', callerLine: 22, callee: 'confirm' });
  g.addImplementsEdge({ implementor: 'OrderServiceImpl', contract: 'OrderService' });
  return g;
}

function fakeResponse(): { markdown: (v: string) => void; calls: string[] } {
  const calls: string[] = [];
  return { markdown: (v: string) => calls.push(v), calls };
}

function fakeRequest(command: string | undefined, prompt: string): vscode.ChatRequest {
  return { command, prompt } as unknown as vscode.ChatRequest;
}

beforeEach(() => {
  __resetExecuteCommand();
});

describe('registerChatParticipant — /impact', () => {
  it('renders impact analysis for a matching symbol', async () => {
    const participant = registerChatParticipant({ getCodeGraph: () => sampleGraph() });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest('impact', 'OrderService.confirm'), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(response.calls).toHaveLength(1);
    expect(response.calls[0]).toContain('Impact Analysis');
    expect(response.calls[0]).toContain('OrderController.create');
  });

  it('routes a bare mention with no command through /impact', async () => {
    const participant = registerChatParticipant({ getCodeGraph: () => sampleGraph() });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest(undefined, 'OrderService'), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(response.calls[0]).toContain('Implementors');
    expect(response.calls[0]).toContain('OrderServiceImpl');
  });

  it('shows help text for a bare mention with no prompt', async () => {
    const participant = registerChatParticipant({ getCodeGraph: () => sampleGraph() });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest(undefined, '   '), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(response.calls[0]).toContain('Available commands');
  });

  it('does not throw and reports no matches when the graph has nothing indexed', async () => {
    const participant = registerChatParticipant({ getCodeGraph: () => new CodeGraph() });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest('impact', 'Nonexistent.symbol'), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(response.calls[0]).toContain('No references found');
  });

  it('reports the graph is unavailable when it has not loaded yet', async () => {
    const participant = registerChatParticipant({ getCodeGraph: () => null });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest('impact', 'Anything'), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(response.calls[0]).toContain('still loading');
  });
});

describe('registerChatParticipant — delegating commands', () => {
  it.each([
    ['document', 'docsAgent.documentFile'],
    ['project', 'docsAgent.documentProject'],
    ['graph', 'docsAgent.showGraph'],
    ['dashboard', 'docsAgent.showDashboard'],
    ['settings', 'docsAgent.openSettings'],
  ])('%s delegates to %s', async (command, expectedCommandId) => {
    const participant = registerChatParticipant({ getCodeGraph: () => null });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest(command, ''), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(__getExecuteCommandCalls()).toEqual([expectedCommandId]);
    expect(response.calls).toHaveLength(1);
  });

  it('shows help text for an unrecognized command', async () => {
    const participant = registerChatParticipant({ getCodeGraph: () => null });
    const handler = (participant as unknown as { requestHandler: vscode.ChatRequestHandler }).requestHandler;
    const response = fakeResponse();

    await handler(fakeRequest('bogus', ''), {} as vscode.ChatContext, response as unknown as vscode.ChatResponseStream, {} as vscode.CancellationToken);

    expect(response.calls[0]).toContain('Available commands');
    expect(__getExecuteCommandCalls()).toEqual([]);
  });
});
