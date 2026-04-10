import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

test('skills module lists local SKILL.md files and toggles registry state', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'familyco-skills-'));
  const skillsRoot = path.join(workspaceRoot, 'skills');

  await mkdir(path.join(skillsRoot, 'founder-ops'), { recursive: true });
  await writeFile(
    path.join(skillsRoot, 'founder-ops', 'SKILL.md'),
    `---
name: founder-ops
description: "Coordinate founder operations from one local skill."
version: "1.0.0"
tags: [operations, founder]
---

# Founder Ops

Run structured operations steps.
`,
    'utf8'
  );

  await mkdir(path.join(skillsRoot, 'broken-skill'), { recursive: true });
  await writeFile(path.join(skillsRoot, 'broken-skill', 'SKILL.md'), '# Broken skill', 'utf8');

  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    skillsRootDir: skillsRoot
  });

  try {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/skills',
      headers: {
        'x-api-key': TEST_API_KEY
      }
    });

    assert.equal(listResponse.statusCode, 200);
    const listPayload = listResponse.json() as {
      items: Array<{ id: string; enabled: boolean }>;
      invalidSkills: Array<{ id: string }>;
    };
    assert.equal(listPayload.items.length, 1);
    assert.equal(listPayload.items[0]?.id, 'founder-ops');
    assert.equal(listPayload.items[0]?.enabled, false);
    assert.equal(listPayload.invalidSkills.length, 1);
    assert.equal(listPayload.invalidSkills[0]?.id, 'broken-skill');

    const enableResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/founder-ops/enable',
      headers: {
        'x-api-key': TEST_API_KEY
      }
    });

    assert.equal(enableResponse.statusCode, 200);
    const enabled = enableResponse.json() as { id: string; enabled: boolean };
    assert.equal(enabled.id, 'founder-ops');
    assert.equal(enabled.enabled, true);

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/skills/founder-ops',
      headers: {
        'x-api-key': TEST_API_KEY
      }
    });

    assert.equal(detailResponse.statusCode, 200);
    const detailPayload = detailResponse.json() as { id: string; enabled: boolean };
    assert.equal(detailPayload.id, 'founder-ops');
    assert.equal(detailPayload.enabled, true);

    const disableResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/skills/founder-ops/disable',
      headers: {
        'x-api-key': TEST_API_KEY
      }
    });

    assert.equal(disableResponse.statusCode, 200);
    const disabled = disableResponse.json() as { id: string; enabled: boolean };
    assert.equal(disabled.id, 'founder-ops');
    assert.equal(disabled.enabled, false);
  } finally {
    await app.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

