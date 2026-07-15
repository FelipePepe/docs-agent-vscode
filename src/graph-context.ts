import type { CbmManager } from './cbm-runner';
import { CBM_CALLER_LABELS } from './graph';

// ── Architecture shape ──────────────────────────────────────────────────────
// Mirrors the JSON returned by codebase-memory-mcp's get_architecture tool.
// Any field may be absent depending on which `aspects` were requested.
export interface ArchitectureData {
  total_nodes?:  number;
  total_edges?:  number;
  node_labels?:  { label: string; count: number }[];
  edge_types?:   { type: string; count: number }[];
  languages?:    { language: string; file_count: number }[];
  packages?:     { name: string; node_count: number; fan_in: number; fan_out: number }[];
  entry_points?: { name: string; qualified_name: string; file: string }[];
  hotspots?:     { name: string; qualified_name: string; fan_in: number }[];
  boundaries?:   { from: string; to: string; call_count: number }[];
  layers?:       { name: string; layer: string; reason: string }[];
  clusters?:     { id: number; label: string; members: number; cohesion: number; top_nodes: string[] }[];
  file_tree?:    unknown;
  [key: string]: unknown;
}

interface GraphProfile {
  aspects: (keyof ArchitectureData)[];
  query?:  (cbm: CbmManager) => Promise<string>;
}

// ── Aspect renderer ──────────────────────────────────────────────────────────
function renderAspects(arch: ArchitectureData, aspects: (keyof ArchitectureData)[]): string {
  const picked: Record<string, unknown> = {};
  for (const key of aspects) {
    if (arch[key] !== undefined) picked[key] = arch[key];
  }
  if (Object.keys(picked).length === 0) return '';
  return JSON.stringify(picked, null, 2);
}

// ── Targeted queries ──────────────────────────────────────────────────────────
async function queryPublicSurface(cbm: CbmManager): Promise<string> {
  try {
    const [interfaces, implementsRows] = await Promise.all([
      cbm.queryGraph(
        "MATCH (n) WHERE n.label = 'Interface' OR n.label = 'Class' " +
        'RETURN n.qualified_name AS qn, n.name AS name, n.file_path AS file LIMIT 100',
      ),
      cbm.queryGraph(
        'MATCH (a:Class|Interface)-[:IMPLEMENTS]->(b) ' +
        'RETURN a.qualified_name AS implementor, b.qualified_name AS contract LIMIT 100',
      ),
    ]);
    if (interfaces.rows.length === 0 && implementsRows.rows.length === 0) return '';
    return JSON.stringify(
      { public_types: interfaces.rows, implements: implementsRows.rows },
      null,
      2,
    );
  } catch {
    return '';
  }
}

async function queryTableEdges(cbm: CbmManager): Promise<string> {
  try {
    const { rows } = await cbm.queryGraph(
      `MATCH (n:${CBM_CALLER_LABELS})-[r]->(t) WHERE t.label = 'Table' ` +
      'RETURN n.qualified_name AS symbol, type(r) AS operation, t.name AS table, n.file_path AS file LIMIT 200',
    );
    if (rows.length === 0) return '';
    return JSON.stringify({ table_operations: rows }, null, 2);
  } catch {
    return '';
  }
}

async function queryDomainNames(cbm: CbmManager): Promise<string> {
  try {
    const { rows } = await cbm.queryGraph(
      "MATCH (n) WHERE n.label = 'Class' OR n.label = 'Interface' OR n.label = 'Type' " +
      'RETURN n.name AS name, n.label AS label LIMIT 150',
    );
    if (rows.length === 0) return '';
    return JSON.stringify({ domain_types: rows }, null, 2);
  } catch {
    return '';
  }
}

// ── Profile catalog (keyed by DocType.id) ─────────────────────────────────────
const DEFAULT_PROFILE: GraphProfile = {
  aspects: ['packages', 'layers', 'entry_points'],
};

const DOC_GRAPH_PROFILES: Record<string, GraphProfile> = {
  'technical-spec':  { aspects: ['layers', 'boundaries', 'packages', 'clusters', 'entry_points'] },
  'c4-context':      { aspects: ['layers', 'boundaries', 'packages', 'clusters', 'entry_points'] },
  'c4-containers':   { aspects: ['layers', 'boundaries', 'packages', 'clusters', 'entry_points'] },
  'c4-components':   { aspects: ['layers', 'boundaries', 'packages', 'clusters', 'entry_points'] },
  adr:               { aspects: ['layers', 'boundaries', 'packages', 'clusters', 'entry_points'] },

  'api-reference':   { aspects: ['entry_points'], query: queryPublicSurface },

  'data-model':      { aspects: [], query: queryTableEdges },
  'data-dictionary': { aspects: [], query: queryTableEdges },

  glossary:          { aspects: ['node_labels'], query: queryDomainNames },

  readme:            { aspects: ['packages', 'entry_points'] },
  onboarding:        { aspects: ['packages', 'entry_points'] },
  contributing:      { aspects: ['packages', 'entry_points'] },
  deployment:        { aspects: ['packages', 'entry_points'] },
};

// ── Public entry point ────────────────────────────────────────────────────────
export async function buildGraphContextForDoc(
  arch: ArchitectureData,
  cbm:  CbmManager,
  docId: string,
): Promise<string> {
  const profile = DOC_GRAPH_PROFILES[docId] ?? DEFAULT_PROFILE;

  const parts: string[] = [];
  const aspectBlock = renderAspects(arch, profile.aspects);
  if (aspectBlock) parts.push(aspectBlock);

  if (profile.query) {
    const queryBlock = await profile.query(cbm);
    if (queryBlock) parts.push(queryBlock);
  }

  return parts.join('\n\n');
}
