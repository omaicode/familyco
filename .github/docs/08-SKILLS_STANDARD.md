# Skills Standard for FamilyCo

## Goal
Define how Skills are stored, discovered, enabled, disabled, and used inside FamilyCo.

## Canonical path
`{CODEBASE}/skills/{SKILL_NAME}/SKILL.md`

## Required rules
- Every skill lives in its own directory.
- Directory name should match the skill slug.
- `SKILL.md` is mandatory.
- Supporting files may exist beside `SKILL.md`.
- Skills may be scanned on app start and on manual rescan.

## Required frontmatter fields
- `name`
- `description`

## Optional frontmatter fields
- `license`
- `compatibility`
- `metadata`

## FamilyCo conventions
- `name` must equal the directory slug.
- Use lowercase letters, numbers, and hyphens only.
- `description` must explain what the skill does and when to use it.
- `compatibility` should mention FamilyCo runtime constraints if relevant.
- `metadata` may include owner, version, tags, allowedModules.

## Recommended skill folder structure
```txt
skills/
└─ finance-analyst/
   ├─ SKILL.md
   ├─ examples.md
   ├─ references.md
   └─ templates/
```

## Why this matters for AI coding
- Keep `SKILL.md` concise so discovery stays cheap.
- Put long examples and references in side files.
- Load side files only when the task truly needs them.
- Store reusable prompts and structured outputs inside each skill folder.

## Example SKILL.md
```md
---
name: finance-analyst
description: Analyze budget usage, identify spend anomalies, and produce concise reports for FamilyCo budget reviews.
compatibility: FamilyCo server runtime, markdown output, no browser needed.
metadata:
  owner: familyco
  version: 1.0.0
  tags: [budget, finance, reporting]
---

# When to use
Use when an agent needs to analyze token or cost data.

# Inputs
- budget usage rows
- time window
- grouping level

# Outputs
- summary
- anomalies
- recommendations
```

## Enable/disable behavior
- Disabled skills remain discoverable in UI but cannot be selected for new runs.
- Existing completed runs still reference disabled skills historically.
- If a run requests a disabled skill, create an Inbox or runtime warning instead of silently using it.