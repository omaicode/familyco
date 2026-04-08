import os from 'node:os';
import { performance } from 'node:perf_hooks';

import { InMemoryQueueService } from '../packages/server/src/queue/in-memory-queue.service.js';

interface LaneResult {
  name: string;
  concurrency: number;
  jobs: number;
  durationMs: number;
  throughputPerSec: number;
}

interface ScenarioResult {
  agent: LaneResult;
  tool: LaneResult;
  totalDurationMs: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function runScenario(agentConcurrency: number, toolConcurrency: number): Promise<ScenarioResult> {
  const queue = new InMemoryQueueService({
    agentRunConcurrency: agentConcurrency,
    toolExecuteConcurrency: toolConcurrency
  });

  const agentJobs = 300;
  const toolJobs = 600;

  queue.setHandlers({
    onAgentRun: async () => {
      await sleep(35);
      return { ok: true };
    },
    onToolExecute: async () => {
      await sleep(20);
      return { ok: true };
    }
  });

  const startedAt = performance.now();

  for (let i = 0; i < agentJobs; i += 1) {
    await queue.enqueue({
      type: 'agent.run',
      payload: {
        request: {
          agentId: `agent-${i}`,
          approvalMode: 'auto',
          action: 'heartbeat.tick',
          toolName: 'task.log',
          toolArguments: { index: i },
          input: `load-test-agent-${i}`
        }
      }
    });
  }

  for (let i = 0; i < toolJobs; i += 1) {
    await queue.enqueue({
      type: 'tool.execute',
      payload: {
        input: {
          toolName: 'task.log',
          arguments: { index: i }
        }
      }
    });
  }

  await queue.close();

  const totalDurationMs = performance.now() - startedAt;

  const agentDurationMs = (agentJobs / agentConcurrency) * 35;
  const toolDurationMs = (toolJobs / toolConcurrency) * 20;

  return {
    agent: {
      name: 'agent.run',
      concurrency: agentConcurrency,
      jobs: agentJobs,
      durationMs: agentDurationMs,
      throughputPerSec: (agentJobs / agentDurationMs) * 1000
    },
    tool: {
      name: 'tool.execute',
      concurrency: toolConcurrency,
      jobs: toolJobs,
      durationMs: toolDurationMs,
      throughputPerSec: (toolJobs / toolDurationMs) * 1000
    },
    totalDurationMs
  };
}

function printScenario(label: string, result: ScenarioResult): void {
  console.log(`\\n[${label}]`);
  console.log(
    `agent.run -> concurrency=${result.agent.concurrency}, jobs=${result.agent.jobs}, est_throughput=${result.agent.throughputPerSec.toFixed(2)} jobs/s`
  );
  console.log(
    `tool.execute -> concurrency=${result.tool.concurrency}, jobs=${result.tool.jobs}, est_throughput=${result.tool.throughputPerSec.toFixed(2)} jobs/s`
  );
  console.log(`total_wall_time=${result.totalDurationMs.toFixed(2)} ms`);
}

async function main(): Promise<void> {
  const cores = os.availableParallelism();
  const baselineAgent = 4;
  const baselineTool = 8;
  const adaptiveAgent = Math.max(2, Math.floor(cores / 2));
  const adaptiveTool = Math.max(4, cores);

  const baseline = await runScenario(baselineAgent, baselineTool);
  const adaptive = await runScenario(adaptiveAgent, adaptiveTool);

  printScenario('baseline', baseline);
  printScenario('adaptive', adaptive);

  const faster = adaptive.totalDurationMs < baseline.totalDurationMs ? 'adaptive' : 'baseline';

  console.log('\\nRecommendation:');
  if (faster === 'adaptive') {
    console.log(`Use adaptive defaults (agent=${adaptiveAgent}, tool=${adaptiveTool} on this machine).`);
  } else {
    console.log(`Keep conservative defaults (agent=${baselineAgent}, tool=${baselineTool}).`);
  }
}

void main();
