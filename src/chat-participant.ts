import * as vscode from 'vscode';
import { CodeGraph, renderImpactDoc } from './graph';

const PARTICIPANT_ID = 'docsAgent.participant';

const HELP_TEXT = [
  'Available commands:',
  '',
  '- `/document` — document the active file',
  '- `/project` — generate the project documentation suite',
  '- `/impact <symbol>` — analyze impact of a class, method, or `Class.method`',
  '- `/graph` — open the interactive code graph panel',
  '- `/dashboard` — open the graph stats / token usage dashboard',
  '- `/settings` — open Docs Agent settings',
  '',
  'You can also just type a symbol name with no command to run impact analysis on it.',
].join('\n');

export interface ChatParticipantDeps {
  getCodeGraph: () => CodeGraph | null;
}

// Thin wrappers over the equivalent Command Palette command — reuses their
// progress UI, QuickPicks, and error handling verbatim instead of duplicating it.
const DELEGATING_COMMANDS: Record<string, { commandId: string; ack: string }> = {
  document:  { commandId: 'docsAgent.documentFile',    ack: 'Documenting the active file — see the notification for progress and the result.' },
  project:   { commandId: 'docsAgent.documentProject', ack: 'Opening the project documentation suite picker.' },
  graph:     { commandId: 'docsAgent.showGraph',       ack: 'Opened the code graph panel.' },
  dashboard: { commandId: 'docsAgent.showDashboard',   ack: 'Opened the dashboard panel.' },
  settings:  { commandId: 'docsAgent.openSettings',    ack: 'Opened Docs Agent settings.' },
};

async function handleImpact(
  symbol: string,
  deps: ChatParticipantDeps,
  response: vscode.ChatResponseStream,
): Promise<void> {
  const trimmed = symbol.trim();
  if (!trimmed) {
    response.markdown('Usage: `/impact <symbol>` — e.g. `/impact OrderService.confirm`');
    return;
  }

  const codeGraph = deps.getCodeGraph();
  if (!codeGraph) {
    response.markdown('The code graph is still loading (or codebase-memory-mcp is unavailable) — try again in a moment.');
    return;
  }

  const impact = codeGraph.queryImpact(trimmed);
  response.markdown(renderImpactDoc(trimmed, impact, codeGraph.nodeCount, codeGraph.edgeCount));
}

export function registerChatParticipant(deps: ChatParticipantDeps): vscode.Disposable {
  const handler: vscode.ChatRequestHandler = async (request, _context, response) => {
    const command = request.command;

    if (command === undefined) {
      if (!request.prompt.trim()) {
        response.markdown(HELP_TEXT);
        return;
      }
      await handleImpact(request.prompt, deps, response);
      return;
    }

    if (command === 'impact') {
      await handleImpact(request.prompt, deps, response);
      return;
    }

    const delegate = DELEGATING_COMMANDS[command];
    if (delegate) {
      await vscode.commands.executeCommand(delegate.commandId);
      response.markdown(delegate.ack);
      return;
    }

    response.markdown(HELP_TEXT);
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  return participant;
}
