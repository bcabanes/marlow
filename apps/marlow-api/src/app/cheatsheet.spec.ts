import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCheatSheet } from './cheatsheet';
import { endpoints } from './openapi';

const cheatSheetPath = join(__dirname, '../../../../docs/agent-cheatsheet.md');

describe('agent cheat-sheet', () => {
  it('matches the committed docs/agent-cheatsheet.md', () => {
    const onDisk = readFileSync(cheatSheetPath, 'utf8');
    // If this fails, copy buildCheatSheet() output into docs/agent-cheatsheet.md.
    expect(buildCheatSheet()).toBe(onDisk);
  });

  it('lists every registered route exactly once', () => {
    const routeLines = buildCheatSheet()
      .split('\n')
      .filter((line) => /^(GET|POST|PATCH|PUT|DELETE) /.test(line));
    expect(routeLines).toHaveLength(endpoints.length);
  });
});
