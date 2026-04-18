const PLAYBOOKS = {
  saas: {
    label: 'SaaS',
    focusAreas: ['acquisition', 'activation', 'retention', 'expansion'],
    workflows: ['pipeline-management', 'customer-onboarding', 'churn-recovery'],
    kpis: ['mrr-growth', 'activation-rate', 'logo-churn', 'net-revenue-retention'],
    risks: ['high-cac', 'slow-onboarding', 'product-adoption-drop'],
    approvalTriggers: ['price-change', 'new-paid-channel', 'contract-commitment'],
    requiredRoles: ['growth-manager', 'product-analyst', 'customer-success-lead']
  },
  retail: {
    label: 'Retail',
    focusAreas: ['inventory-velocity', 'category-margin', 'sell-through', 'store-ops'],
    workflows: ['demand-planning', 'inventory-replenishment', 'promotion-execution'],
    kpis: ['stockout-rate', 'sell-through-rate', 'gross-margin-return-on-inventory', 'promotion-lift'],
    risks: ['overstock', 'stockout', 'markdown-leakage'],
    approvalTriggers: ['bulk-purchase-order', 'pricing-campaign', 'supplier-switch'],
    requiredRoles: ['merchandising-lead', 'inventory-planner', 'store-operations-manager']
  },
  healthcare: {
    label: 'Healthcare',
    focusAreas: ['care-quality', 'patient-flow', 'safety', 'compliance'],
    workflows: ['patient-intake', 'care-coordination', 'discharge-follow-up'],
    kpis: ['wait-time', 'readmission-rate', 'care-plan-adherence', 'incident-rate'],
    risks: ['privacy-breach', 'handoff-error', 'care-delay'],
    approvalTriggers: ['care-protocol-change', 'new-vendor-access', 'sensitive-data-export'],
    requiredRoles: ['care-coordinator', 'clinical-operations-lead', 'compliance-officer']
  },
  education: {
    label: 'Education',
    focusAreas: ['learner-outcomes', 'curriculum-quality', 'engagement', 'intervention'],
    workflows: ['curriculum-planning', 'cohort-monitoring', 'learner-support'],
    kpis: ['completion-rate', 'assessment-improvement', 'attendance-rate', 'intervention-closure-time'],
    risks: ['dropout-spike', 'curriculum-drift', 'assessment-bias'],
    approvalTriggers: ['grading-policy-change', 'new-student-data-tool', 'external-content-partnership'],
    requiredRoles: ['program-manager', 'instructional-designer', 'student-success-manager']
  },
  manufacturing: {
    label: 'Manufacturing',
    focusAreas: ['throughput', 'yield', 'quality', 'downtime'],
    workflows: ['production-planning', 'quality-control', 'maintenance-escalation'],
    kpis: ['overall-equipment-effectiveness', 'first-pass-yield', 'defect-rate', 'downtime-minutes'],
    risks: ['quality-escape', 'line-stoppage', 'supplier-latency'],
    approvalTriggers: ['process-change', 'new-critical-supplier', 'shutdown-maintenance-window'],
    requiredRoles: ['production-planner', 'quality-engineer', 'maintenance-coordinator']
  },
  hospitality: {
    label: 'Hospitality',
    focusAreas: ['occupancy', 'guest-experience', 'service-speed', 'reputation'],
    workflows: ['reservation-operations', 'guest-service-recovery', 'event-execution'],
    kpis: ['occupancy-rate', 'average-daily-rate', 'guest-satisfaction-index', 'service-recovery-time'],
    risks: ['overbooking', 'service-failure', 'staffing-gap'],
    approvalTriggers: ['large-event-commitment', 'rate-policy-change', 'vendor-contract-change'],
    requiredRoles: ['front-office-manager', 'guest-experience-lead', 'revenue-manager']
  }
};

const INDUSTRY_ALIASES = {
  software: 'saas',
  'software-as-a-service': 'saas',
  ecommerce: 'retail',
  'e-commerce': 'retail',
  hospital: 'healthcare',
  clinic: 'healthcare',
  school: 'education',
  university: 'education',
  factory: 'manufacturing',
  hotel: 'hospitality',
  restaurant: 'hospitality'
};

const KPI_LIBRARY = {
  common: {
    operations: [
      { name: 'cycle-time', unit: 'hours', direction: 'decrease' },
      { name: 'rework-rate', unit: '%', direction: 'decrease' },
      { name: 'throughput', unit: 'units/week', direction: 'increase' }
    ],
    finance: [
      { name: 'gross-margin', unit: '%', direction: 'increase' },
      { name: 'operating-cost-per-unit', unit: 'currency/unit', direction: 'decrease' },
      { name: 'cash-conversion-cycle', unit: 'days', direction: 'decrease' }
    ]
  },
  saas: {
    growth: [
      { name: 'mrr-growth', unit: '%', direction: 'increase' },
      { name: 'trial-to-paid-rate', unit: '%', direction: 'increase' },
      { name: 'cac-payback', unit: 'months', direction: 'decrease' }
    ],
    product: [
      { name: 'activation-rate', unit: '%', direction: 'increase' },
      { name: 'feature-adoption', unit: '%', direction: 'increase' },
      { name: 'time-to-value', unit: 'days', direction: 'decrease' }
    ]
  },
  retail: {
    operations: [
      { name: 'stockout-rate', unit: '%', direction: 'decrease' },
      { name: 'sell-through-rate', unit: '%', direction: 'increase' },
      { name: 'inventory-days-on-hand', unit: 'days', direction: 'decrease' }
    ]
  },
  healthcare: {
    operations: [
      { name: 'patient-wait-time', unit: 'minutes', direction: 'decrease' },
      { name: 'care-plan-adherence', unit: '%', direction: 'increase' },
      { name: 'readmission-rate', unit: '%', direction: 'decrease' }
    ]
  },
  education: {
    operations: [
      { name: 'attendance-rate', unit: '%', direction: 'increase' },
      { name: 'assessment-improvement', unit: '%', direction: 'increase' },
      { name: 'intervention-closure-time', unit: 'days', direction: 'decrease' }
    ]
  },
  manufacturing: {
    operations: [
      { name: 'overall-equipment-effectiveness', unit: '%', direction: 'increase' },
      { name: 'first-pass-yield', unit: '%', direction: 'increase' },
      { name: 'defect-rate', unit: '%', direction: 'decrease' }
    ]
  },
  hospitality: {
    operations: [
      { name: 'occupancy-rate', unit: '%', direction: 'increase' },
      { name: 'guest-satisfaction-index', unit: '/100', direction: 'increase' },
      { name: 'service-recovery-time', unit: 'minutes', direction: 'decrease' }
    ]
  }
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveIndustry(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const key = INDUSTRY_ALIASES[raw] ?? raw;
  return PLAYBOOKS[key] ? key : null;
}

function listSupportedIndustries() {
  return Object.keys(PLAYBOOKS);
}

function invalidArguments(message) {
  return { ok: false, error: { code: 'INVALID_ARGUMENTS', message } };
}

function unsupportedIndustry() {
  return {
    ok: false,
    error: {
      code: 'UNSUPPORTED_INDUSTRY',
      message: `Unsupported industry. Supported values: ${listSupportedIndustries().join(', ')}`
    }
  };
}

function parseRolesCsv(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function buildHandoffMarkdown(input) {
  return [
    `## Initiative`,
    input.initiativeName,
    '',
    `## Industry Context`,
    input.industryLabel,
    '',
    `## Owner Role`,
    input.ownerRole,
    '',
    `## Requested Outcome`,
    input.requestedOutcome,
    '',
    `## Constraints`,
    input.constraints || 'No extra constraints provided.',
    '',
    `## Definition of Done`,
    '- Deliverables are clearly listed and verifiable.',
    '- Risks and approval checkpoints are highlighted.',
    '- Next handoff owner and expected input format are explicit.'
  ].join('\n');
}

/** @type {import('@familyco/core').PluginToolDefinition[]} */
export const industryTools = [
  {
    name: 'suggest_industry_playbook',
    description: 'Return an execution playbook template for a specific industry and objective.',
    parameters: [
      { name: 'industry', type: 'string', required: true, description: 'Industry name, e.g. saas, retail, healthcare.' },
      { name: 'objective', type: 'string', required: true, description: 'Business objective to optimize for.' },
      { name: 'constraints', type: 'string', required: false, description: 'Optional business constraints or guardrails.' }
    ],
    async execute(args) {
      const industry = resolveIndustry(args.industry);
      const objective = typeof args.objective === 'string' ? args.objective.trim() : '';
      const constraints = typeof args.constraints === 'string' ? args.constraints.trim() : '';

      if (!industry) return unsupportedIndustry();
      if (!objective) return invalidArguments('objective is required.');

      const playbook = PLAYBOOKS[industry];
      return {
        ok: true,
        output: {
          industry,
          industryLabel: playbook.label,
          objective,
          constraints,
          focusAreas: playbook.focusAreas,
          recommendedWorkflows: playbook.workflows,
          suggestedKpis: playbook.kpis,
          riskWatchlist: playbook.risks,
          approvalTriggers: playbook.approvalTriggers,
          suggestedRoles: playbook.requiredRoles
        }
      };
    }
  },
  {
    name: 'build_kpi_scorecard',
    description: 'Build a KPI scorecard draft by industry and function area.',
    parameters: [
      { name: 'industry', type: 'string', required: true, description: 'Industry name.' },
      { name: 'functionArea', type: 'string', required: true, description: 'Function area, e.g. operations, growth, finance, product.' },
      { name: 'maturityStage', type: 'string', required: false, description: 'Optional stage such as early, scaling, mature.' }
    ],
    async execute(args) {
      const industry = resolveIndustry(args.industry);
      const functionArea = normalizeText(args.functionArea);
      const maturityStage = typeof args.maturityStage === 'string' ? args.maturityStage.trim() : '';

      if (!industry) return unsupportedIndustry();
      if (!functionArea) return invalidArguments('functionArea is required.');

      const industryMetrics = KPI_LIBRARY[industry]?.[functionArea] ?? [];
      const fallbackMetrics = KPI_LIBRARY.common[functionArea] ?? KPI_LIBRARY.common.operations;
      const metrics = industryMetrics.length > 0 ? industryMetrics : fallbackMetrics;

      return {
        ok: true,
        output: {
          industry,
          functionArea,
          maturityStage,
          metrics,
          note:
            industryMetrics.length > 0
              ? 'Industry-specific metrics selected.'
              : 'No exact industry/function match. Common metrics fallback used.'
        }
      };
    }
  },
  {
    name: 'generate_operating_checklist',
    description: 'Generate an operating checklist for a selected industry workflow.',
    parameters: [
      { name: 'industry', type: 'string', required: true, description: 'Industry name.' },
      { name: 'workflow', type: 'string', required: false, description: 'Workflow name. If omitted, the first recommended workflow is used.' },
      { name: 'riskLevel', type: 'string', required: false, description: 'Optional risk level: low, medium, high.' }
    ],
    async execute(args) {
      const industry = resolveIndustry(args.industry);
      if (!industry) return unsupportedIndustry();

      const workflow = normalizeText(args.workflow);
      const riskLevel = normalizeText(args.riskLevel) || 'medium';
      const playbook = PLAYBOOKS[industry];
      const selectedWorkflow = workflow && playbook.workflows.includes(workflow) ? workflow : playbook.workflows[0];

      const checklist = [
        `Confirm scope and owner for ${selectedWorkflow}.`,
        'Validate baseline metrics before execution.',
        'Create task breakdown with clear acceptance criteria.',
        'Assign execution owners and escalation path.',
        'Run mid-cycle review and adjust if deviations exceed threshold.',
        'Capture closeout summary and update operational knowledge.'
      ];

      const approvalCheckpoints =
        riskLevel === 'high'
          ? ['Approval before external commitment.', 'Approval before production rollout.']
          : ['Approval for irreversible changes.'];

      return {
        ok: true,
        output: {
          industry,
          workflow: selectedWorkflow,
          riskLevel,
          checklist,
          approvalCheckpoints
        }
      };
    }
  },
  {
    name: 'compose_handoff_brief',
    description: 'Compose a structured markdown brief for agent-to-agent handoff.',
    parameters: [
      { name: 'industry', type: 'string', required: true, description: 'Industry name.' },
      { name: 'initiativeName', type: 'string', required: true, description: 'Initiative or task stream title.' },
      { name: 'ownerRole', type: 'string', required: true, description: 'Role that owns this handoff.' },
      { name: 'requestedOutcome', type: 'string', required: true, description: 'Expected outcome from the receiving agent.' },
      { name: 'constraints', type: 'string', required: false, description: 'Optional constraints and non-negotiables.' }
    ],
    async execute(args) {
      const industry = resolveIndustry(args.industry);
      const initiativeName = typeof args.initiativeName === 'string' ? args.initiativeName.trim() : '';
      const ownerRole = typeof args.ownerRole === 'string' ? args.ownerRole.trim() : '';
      const requestedOutcome = typeof args.requestedOutcome === 'string' ? args.requestedOutcome.trim() : '';
      const constraints = typeof args.constraints === 'string' ? args.constraints.trim() : '';

      if (!industry) return unsupportedIndustry();
      if (!initiativeName || !ownerRole || !requestedOutcome) {
        return invalidArguments('initiativeName, ownerRole, and requestedOutcome are required.');
      }

      return {
        ok: true,
        output: {
          industry,
          briefMarkdown: buildHandoffMarkdown({
            industryLabel: PLAYBOOKS[industry].label,
            initiativeName,
            ownerRole,
            requestedOutcome,
            constraints
          })
        }
      };
    }
  },
  {
    name: 'map_capability_gaps',
    description: 'Compare current role coverage against typical role requirements for an industry.',
    parameters: [
      { name: 'industry', type: 'string', required: true, description: 'Industry name.' },
      { name: 'currentRoles', type: 'string', required: true, description: 'Comma-separated role list currently available.' },
      { name: 'targetOutcome', type: 'string', required: true, description: 'Outcome the team wants to deliver.' }
    ],
    async execute(args) {
      const industry = resolveIndustry(args.industry);
      const currentRoles = parseRolesCsv(args.currentRoles);
      const targetOutcome = typeof args.targetOutcome === 'string' ? args.targetOutcome.trim() : '';

      if (!industry) return unsupportedIndustry();
      if (currentRoles.length === 0 || !targetOutcome) {
        return invalidArguments('currentRoles and targetOutcome are required.');
      }

      const requiredRoles = PLAYBOOKS[industry].requiredRoles;
      const missingRoles = requiredRoles.filter((role) => !currentRoles.includes(role));

      return {
        ok: true,
        output: {
          industry,
          targetOutcome,
          currentRoles,
          requiredRoles,
          missingRoles,
          suggestedActions:
            missingRoles.length > 0
              ? missingRoles.map((role) => `Assign or create an agent profile for ${role}.`)
              : ['Current role coverage is sufficient for baseline execution.']
        }
      };
    }
  }
];
