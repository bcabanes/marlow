import { Endpoint, bodySchemas, endpoints, parameters } from './openapi.js';

/**
 * Renders the terse agent cheat-sheet from the same `endpoints` table that
 * builds the OpenAPI document, so the two can never drift. The cheat-sheet is
 * meant to live in an agent's always-loaded instructions, sparing it the cost
 * of fetching the full `/openapi.json` for routine calls.
 *
 * `cheatsheet.spec.ts` asserts the committed `docs/agent-cheatsheet.md` equals
 * this output. To regenerate after changing `endpoints`, copy this output into
 * that file (the failing test prints the diff).
 */

const PREAMBLE: readonly string[] = [
  '# Marlow API cheat-sheet',
  '',
  'Local GitHub broker — least-privilege access to an allow-listed set of private',
  'repositories. JSON only; writes require `{ "confirm": true }` in the body. This',
  'is a generated summary; GET /openapi.json for the full request/response schema.',
  '',
  'Format: `METHOD path [?query] [body{...}] -> ReturnType`; a `?` suffix marks an',
  'optional field. List endpoints return trimmed `*Summary`/`*ListItem` rows with',
  'no body — fetch a single resource for the full body.',
];

const formatLine = (endpoint: Endpoint): string => {
  const segments: string[] = [endpoint.method.toUpperCase(), endpoint.path];

  const query = (endpoint.params ?? [])
    .map((name) => parameters[name])
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => parameter.name);
  if (query.length) segments.push(`?${query.join(',')}`);

  if (endpoint.body) {
    const schema = bodySchemas[endpoint.body];
    const required = new Set<string>(schema.required);
    const keys = Object.keys(schema.properties).map((key) =>
      required.has(key) ? key : `${key}?`,
    );
    segments.push(`body{${keys.join(',')}}`);
  }

  segments.push('->', endpoint.returns);
  return segments.join(' ');
};

/** Build the markdown cheat-sheet for every Marlow route. */
export const buildCheatSheet = (): string => {
  const lines: string[] = [...PREAMBLE];
  let currentTag: string | null = null;
  for (const endpoint of endpoints) {
    if (endpoint.tag !== currentTag) {
      lines.push('', `## ${endpoint.tag}`, '');
      currentTag = endpoint.tag;
    }
    lines.push(formatLine(endpoint));
  }
  return `${lines.join('\n')}\n`;
};
