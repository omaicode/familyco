import { SettingsService } from '@familyco/core';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from '../app.js';
import { InMemorySettingsRepository } from '../repositories/in-memory-settings.repository.js';
import { SkillsService } from '../modules/skills/skills.service.js';
import { TEST_API_KEY } from './test-helpers.js';

test('skills module loads default skills and keeps manual toggles working', async () => {
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
metadata:
  default: true
  apply_to: ['L0']
---

# Founder Ops

Run structured operations steps.
`,
    'utf8'
  );

  await mkdir(path.join(skillsRoot, 'manager-ops'), { recursive: true });
  await writeFile(
    path.join(skillsRoot, 'manager-ops', 'SKILL.md'),
    `---
name: manager-ops
description: "Coordinate team execution for manager agents."
metadata:
  default: false
  apply_to: ['L1']
---

# Manager Ops

Run structured manager operations steps.
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
    assert.equal(listPayload.items.length, 2);
    assert.equal(listPayload.items.find((item) => item.id === 'founder-ops')?.enabled, true);
    assert.equal(listPayload.items.find((item) => item.id === 'manager-ops')?.enabled, false);
    assert.equal(listPayload.invalidSkills.length, 1);
    assert.equal(listPayload.invalidSkills[0]?.id, 'broken-skill');

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
  } finally {
    await app.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('SkillsService filters default skills by apply_to and exposes full paths', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'familyco-skills-filter-'));
  const skillsRoot = path.join(workspaceRoot, 'skills');

  await mkdir(path.join(skillsRoot, 'all-hands'), { recursive: true });
  await writeFile(
    path.join(skillsRoot, 'all-hands', 'SKILL.md'),
    `---
name: all-hands
description: "Available to every agent."
metadata:
  default: true
  apply_to: []
---

# All Hands

General guidance for all agents.
`,
    'utf8'
  );

  await mkdir(path.join(skillsRoot, 'exec-only'), { recursive: true });
  await writeFile(
    path.join(skillsRoot, 'exec-only', 'SKILL.md'),
    `---
name: exec-only
description: "Only for executives."
metadata:
  default: true
  apply_to: ['L0']
---

# Exec Only

Executive-only guidance.
`,
    'utf8'
  );

  await mkdir(path.join(skillsRoot, 'manager-only'), { recursive: true });
  await writeFile(
    path.join(skillsRoot, 'manager-only', 'SKILL.md'),
    `---
name: manager-only
description: "Only for managers."
metadata:
  default: true
  apply_to: ['L1']
---

# Manager Only

Manager-only guidance.
`,
    'utf8'
  );

  const service = new SkillsService(new SettingsService(new InMemorySettingsRepository()), skillsRoot);

  try {
    const executiveSkills = await service.listForAgent({ level: 'L0' });
    const managerSkills = await service.listForAgent({ level: 'L1' });

    assert.deepEqual(executiveSkills.map((skill) => skill.id).sort(), ['all-hands', 'exec-only']);
    assert.deepEqual(managerSkills.map((skill) => skill.id).sort(), ['all-hands', 'manager-only']);
    assert.equal(executiveSkills.every((skill) => path.isAbsolute(skill.path)), true);
    assert.equal(managerSkills.every((skill) => path.isAbsolute(skill.path)), true);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
