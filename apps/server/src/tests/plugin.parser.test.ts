import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parsePluginMarkdown } from '../modules/plugins/plugin.parser.js';

describe('parsePluginMarkdown', () => {
  const VALID_MANIFEST = `---
title: Web Researcher
name: web-researcher
description: Adds web search and URL fetch capabilities to agents.
entry: index.ts
capabilities:
  - kind: web-search, name: web_search, description: Search the web
  - kind: web-fetch, name: web_fetch, description: Fetch content from a URL
metadata:
  version: 1.2.3
  author: FamilyCo
  approval_mode: require_review
  tags: web, research
---

# Web Researcher

Body copy here.
`;

  it('parses a valid PLUGIN.md into a PluginManifest', () => {
    const manifest = parsePluginMarkdown({ content: VALID_MANIFEST, defaultId: 'web-researcher' });

    assert.equal(manifest.id, 'web-researcher');
    assert.equal(manifest.name, 'Web Researcher');
    assert.equal(manifest.description, 'Adds web search and URL fetch capabilities to agents.');
    assert.equal(manifest.version, '1.2.3');
    assert.equal(manifest.author, 'FamilyCo');
    assert.equal(manifest.entry, 'index.ts');
    assert.equal(manifest.defaultApprovalMode, 'require_review');
    assert.deepEqual(manifest.tags, ['web', 'research']);

    assert.equal(manifest.capabilities.length, 2);

    const [search, fetch] = manifest.capabilities;
    assert.equal(search.kind, 'web-search');
    assert.equal(search.name, 'web_search');
    assert.equal(fetch.kind, 'web-fetch');
    assert.equal(fetch.name, 'web_fetch');
  });

  it('falls back to default id from directory name when name is omitted', () => {
    const content = `---
description: A minimal plugin.
---
`;
    const manifest = parsePluginMarkdown({ content, defaultId: 'my-plugin' });
    assert.equal(manifest.id, 'my-plugin');
  });

  it('throws when description is missing', () => {
    const content = `---
name: bad-plugin
---
`;
    assert.throws(
      () => parsePluginMarkdown({ content, defaultId: 'bad-plugin' }),
      /PLUGIN_INVALID_DESCRIPTION/
    );
  });

  it('skips capabilities with invalid kind', () => {
    const content = `---
name: partial-plugin
description: A plugin with one bad capability.
capabilities:
  - kind: unknown-kind, name: foo, description: bad
  - kind: web-search, name: web_q, description: ok
---
`;
    const manifest = parsePluginMarkdown({ content, defaultId: 'partial-plugin' });
    const kinds = manifest.capabilities.map((c) => c.kind);
    assert.ok(!kinds.includes('unknown-kind' as never), 'Invalid kind should be skipped');
    assert.ok(kinds.includes('web-search'), 'Valid kind should be present');
  });

  it('defaults approval_mode to require_review when invalid value is provided', () => {
    const content = `---
name: safe-plugin
description: Safety test plugin.
metadata:
  approval_mode: INVALID_VALUE
---
`;
    const manifest = parsePluginMarkdown({ content, defaultId: 'safe-plugin' });
    assert.equal(manifest.defaultApprovalMode, 'require_review');
  });

  it('accepts auto as a valid approval_mode', () => {
    const content = `---
name: auto-plugin
description: Auto approval plugin.
metadata:
  approval_mode: auto
---
`;
    const manifest = parsePluginMarkdown({ content, defaultId: 'auto-plugin' });
    assert.equal(manifest.defaultApprovalMode, 'auto');
  });

  it('uses version 0.0.0 when metadata.version is absent', () => {
    const content = `---
name: no-version
description: Plugin without version.
---
`;
    const manifest = parsePluginMarkdown({ content, defaultId: 'no-version' });
    assert.equal(manifest.version, '0.0.0');
  });
});
