import { PluginRegistry, SettingsService } from '@familyco/core';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from '../app.js';
import { InMemorySettingsRepository } from '../repositories/in-memory-settings.repository.js';
import { SkillsService } from '../modules/skills/skills.service.js';
import { TEST_API_KEY } from './test-helpers.js';

test('skills module lists plugin skills and keeps per-skill toggles working', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'familyco-skills-'));
  const pluginsRoot = path.join(workspaceRoot, 'plugins');
  const skillsRoot = path.join(workspaceRoot, 'skills');

  // Create a synthetic plugin with two skills
  const pluginDir = path.join(pluginsRoot, 'test-skills-plugin');
  await mkdir(path.join(pluginDir, 'src'), { recursive: true });

  await writeFile(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: 'test-skills-plugin', type: 'module', familyco: { plugin: true, entry: 'src/index.js' } }),
    'utf8'
  );

  await writeFile(
    path.join(pluginDir, 'src', 'index.js'),
    `const plugin = {
  name: 'Test Skills Plugin',
  description: 'Plugin for skill testing.',
  tools: [],
  skills: [
    { name: 'alpha-skill', description: 'Alpha skill.', content: '# Alpha', applyTo: ['L0'], enabledByDefault: true },
    { name: 'beta-skill', description: 'Beta skill for all.', content: '# Beta', applyTo: [] }
  ]
};
export default plugin;
`,
    'utf8'
  );

  const localSkillDir = path.join(skillsRoot, 'workspace-local');
  await mkdir(localSkillDir, { recursive: true });
  await writeFile(
    path.join(localSkillDir, 'SKILL.md'),
    `---
name: workspace-local
description: Workspace local skill.
metadata:
  default: true
---

# Workspace Local

Use this skill for local testing.
`,
    'utf8'
  );

  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    pluginsRootDir: pluginsRoot,
    skillsRootDir: skillsRoot
  });

  try {
    // Enable the plugin so its skills are visible
    const enablePluginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/plugins/test-skills-plugin/enable',
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(enablePluginResponse.statusCode, 200);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/skills',
      headers: { 'x-api-key': TEST_API_KEY }
    });

    assert.equal(listResponse.statusCode, 200);
    const listPayload = listResponse.json() as {
      items: Array<{ id: string; enabled: boolean }>;
      invalidSkills: Array<{ id: string }>;
    };
    assert.equal(listPayload.items.length, 3);
    assert.equal(listPayload.invalidSkills.length, 0);

    const alpha = listPayload.items.find((item) => item.id.endsWith(':alpha-skill'));
    const beta = listPayload.items.find((item) => item.id.endsWith(':beta-skill'));
    const workspaceLocal = listPayload.items.find((item) => item.id === 'workspace-local');
    assert.ok(alpha, 'alpha-skill should be in the list');
    assert.ok(beta, 'beta-skill should be in the list');
    assert.ok(workspaceLocal, 'workspace-local should be in the list');
    assert.equal(alpha!.enabled, true);
    assert.equal(beta!.enabled, false);
    assert.equal(workspaceLocal!.enabled, true);

    const alphaId = alpha?.id;
    assert.ok(alphaId, 'alpha-skill should be in the list');

    // Disable alpha-skill
    const disableResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${encodeURIComponent(alphaId!)}/disable`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(disableResponse.statusCode, 200);
    const disabled = disableResponse.json() as { id: string; enabled: boolean };
    assert.equal(disabled.enabled, false);

    // Re-enable alpha-skill
    const enableResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/skills/${encodeURIComponent(alphaId!)}/enable`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(enableResponse.statusCode, 200);
    const enabled = enableResponse.json() as { id: string; enabled: boolean };
    assert.equal(enabled.enabled, true);

    // GET by id
    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/skills/${encodeURIComponent(alphaId!)}`,
      headers: { 'x-api-key': TEST_API_KEY }
    });
    assert.equal(detailResponse.statusCode, 200);
    const detail = detailResponse.json() as { id: string; enabled: boolean };
    assert.equal(detail.id, alphaId);
    assert.equal(detail.enabled, true);
  } finally {
    await app.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('SkillsService filters plugin skills by applyTo', async () => {
  const registry = new PluginRegistry();

  registry.register({
    id: 'test-plugin',
    name: 'Test Plugin',
    description: 'Test',
    version: '1.0.0',
    author: null,
    tags: [],
    path: '/tmp/test-plugin',
    entry: 'src/index.js',
    capabilities: [],
    state: 'enabled',
    approvalMode: 'auto',
    checksum: 'test',
    errorMessage: null,
    discoveredAt: new Date(),
    updatedAt: new Date()
  });
  registry.setLoadedModule('test-plugin', {
    name: 'Test Plugin',
    description: 'Test',
    tools: [],
    skills: [
      { name: 'all-agents', description: 'All agents skill.', content: '# All', applyTo: [], enabledByDefault: true },
      { name: 'exec-only', description: 'Exec only skill.', content: '# Exec', applyTo: ['L0'], enabledByDefault: true },
      { name: 'manager-only', description: 'Manager only skill.', content: '# Manager', applyTo: ['L1'], enabledByDefault: true }
    ]
  });

  const service = new SkillsService(new SettingsService(new InMemorySettingsRepository()), registry);

  const executiveSkills = await service.listForAgent({ level: 'L0' });
  const managerSkills = await service.listForAgent({ level: 'L1' });

  assert.deepEqual(
    executiveSkills.map((s) => s.name).sort(),
    ['all-agents', 'exec-only']
  );
  assert.deepEqual(
    managerSkills.map((s) => s.name).sort(),
    ['all-agents', 'manager-only']
  );

  // All plugin skill paths start with [plugin:...]
  assert.ok(executiveSkills.every((s) => s.path.startsWith('[plugin:')));
  assert.ok(managerSkills.every((s) => s.path.startsWith('[plugin:')));
});

test('SkillsService loads workspace skills from skills/*/SKILL.md and reports invalid entries', async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'familyco-local-skills-'));
  const skillsRoot = path.join(workspaceRoot, 'skills');

  try {
    const validSkillDir = path.join(skillsRoot, 'workflow-helper');
    await mkdir(validSkillDir, { recursive: true });
    await writeFile(
      path.join(validSkillDir, 'SKILL.md'),
      `---
name: workflow-helper
description: Helps with workflow tasks.
metadata:
  default: true
  apply_to: [L0]
---

# Workflow Helper

Guidance for workflow tasks.
`,
      'utf8'
    );

    const invalidSkillDir = path.join(skillsRoot, 'broken-skill');
    await mkdir(invalidSkillDir, { recursive: true });
    await writeFile(
      path.join(invalidSkillDir, 'SKILL.md'),
      `---
name: broken-skill
---

# Broken Skill
`,
      'utf8'
    );

    const service = new SkillsService(new SettingsService(new InMemorySettingsRepository()), undefined, skillsRoot);
    const listed = await service.list();
    const agentSkills = await service.listForAgent({ level: 'L0' });

    assert.deepEqual(listed.items.map((item) => item.id), ['workflow-helper']);
    assert.equal(listed.invalidSkills.length, 1);
    assert.equal(listed.invalidSkills[0]?.id, 'broken-skill');
    assert.deepEqual(agentSkills.map((item) => item.id), ['workflow-helper']);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
