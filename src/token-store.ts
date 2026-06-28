export interface TokenRecord {
  timestamp: number;
  provider:  string;
  model:     string;
  command:   string;
  promptTokens:     number;
  completionTokens: number;
}

const _records: TokenRecord[] = [];

export function recordTokenUsage(r: TokenRecord): void {
  _records.push(r);
}

export function getTokenRecords(): readonly TokenRecord[] {
  return _records;
}

export function getTokenTotals(): { promptTokens: number; completionTokens: number; calls: number } {
  return _records.reduce(
    (acc, r) => ({
      promptTokens:     acc.promptTokens     + r.promptTokens,
      completionTokens: acc.completionTokens + r.completionTokens,
      calls:            acc.calls            + 1,
    }),
    { promptTokens: 0, completionTokens: 0, calls: 0 },
  );
}
