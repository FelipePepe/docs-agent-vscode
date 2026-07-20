// Minimal stub of the 'vscode' module for unit tests.
// Only the surface used by src modules under test is implemented.

const configStore = new Map<string, unknown>();

export function __setConfig(key: string, value: unknown): void {
  configStore.set(key, value);
}

export function __resetConfig(): void {
  configStore.clear();
}

export const workspace = {
  getConfiguration(section?: string) {
    return {
      get<T>(key: string, defaultValue: T): T {
        const fullKey = section ? `${section}.${key}` : key;
        return configStore.has(fullKey) ? (configStore.get(fullKey) as T) : defaultValue;
      },
      inspect<T>(key: string): { globalValue: T | undefined } {
        const fullKey = section ? `${section}.${key}` : key;
        return { globalValue: configStore.has(fullKey) ? (configStore.get(fullKey) as T) : undefined };
      },
    };
  },
};

export const Uri = {
  file(fsPath: string) {
    return { fsPath, scheme: 'file' };
  },
};

let executeCommandCalls: string[] = [];

export function __resetExecuteCommand(): void {
  executeCommandCalls = [];
}

export function __getExecuteCommandCalls(): string[] {
  return executeCommandCalls;
}

export const commands = {
  async executeCommand(command: string): Promise<void> {
    executeCommandCalls.push(command);
  },
};

export const chat = {
  createChatParticipant(id: string, requestHandler: unknown) {
    return { id, requestHandler, dispose() { /* no-op in tests */ } };
  },
};
