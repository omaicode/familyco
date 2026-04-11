import type {
  AgentLevel,
  AiAdapterRegistry,
  AdapterChatAttachment,
  SettingsService,
  ToolExecutionResult
} from '@familyco/core';
import { runAgentLoop } from '@familyco/core';
import type { AgentLoopEvent } from '@familyco/core';
import type { PromptConversationEntry } from '../../prompts/prompt.types.js';
import { renderChatSystemPrompt, renderChatUserPrompt } from '../../prompts/index.js';
import { buildAgentSlashRegistry } from './agent-chat.registry.js';
import type { ToolSlashEntry } from './agent-chat.registry.js';
import type { ChatToolCall } from './agent.types.js';
import type { SkillsService } from '../skills/skills.service.js';
import type { ToolDefinitionSummary } from '../../tools/tool.types.js';
import { asNonEmptyString, isRecord } from '../../tools/tool.helpers.js';
import { toChatToolCall } from './chat-tool-call.js';

export interface ChatEngineRunInput {
  agentAdapterId?: string | null;
  agentModel?: string | null;
  agentLevel?: AgentLevel;
  message: string;
  companyProfile: { companyName: string; companyDescription: string };
  conversationHistory: PromptConversationEntry[];
  availableTools: ToolDefinitionSummary[];
  attachments?: AdapterChatAttachment[];
  onEvent?: (event: AgentLoopEvent) => void;
  abortSignal?: AbortSignal;
  shouldStop?: () => boolean;
  executeTool: (input: { toolName: string; arguments: Record<string, unknown> }) => Promise<ToolExecutionResult>;
}

export interface ChatEngineResult {
  reply: string;
  toolCalls: ChatToolCall[];
  task: unknown | null;
  project: unknown | null;
  confirmRequest?: { question: string; options: string[] };
}

type AdapterId = 'openai' | 'claude';

interface AdapterConfig {
  adapterId: AdapterId;
  apiKey: string;
  model: string;
}

export class ChatEngineService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly adapterRegistry: AiAdapterRegistry,
    private readonly skillsService?: SkillsService
  ) {}

  async run(input: ChatEngineRunInput): Promise<ChatEngineResult> {
    const adapterConfig = await this.resolveAdapterConfig(input.agentAdapterId, input.agentModel);
    if (!adapterConfig) {
      return { reply: '', toolCalls: [], task: null, project: null };
    }

    const adapter = this.adapterRegistry.get(adapterConfig.adapterId);
    if (!adapter) {
      throw new Error(`ADAPTER_NOT_FOUND:${adapterConfig.adapterId}`);
    }

    const filteredTools = filterToolsForAgent(input.availableTools, input.agentLevel ?? 'L0');

    const systemPrompt = renderChatSystemPrompt({
      companyName: input.companyProfile.companyName,
      companyDescription: input.companyProfile.companyDescription,
      tools: filteredTools,
      conversationHistory: input.conversationHistory
    });

    const userPrompt = renderChatUserPrompt({
      message: input.message,
      conversationHistory: input.conversationHistory
    });

    const toolCalls: ChatToolCall[] = [];
    let task: unknown | null = null;
    let project: unknown | null = null;
    let confirmRequest: { question: string; options: string[] } | undefined;

    const loopResult = await runAgentLoop({
      adapter,
      apiKey: adapterConfig.apiKey,
      model: adapterConfig.model,
      systemPrompt,
      userPrompt,
      attachments: input.attachments,
      availableTools: filteredTools,
      onEvent: input.onEvent,
      abortSignal: input.abortSignal,
      shouldStop: input.shouldStop,
      executeTool: async (toolInput) => {
        const result = await input.executeTool(toolInput);

        if (toolInput.toolName === 'confirm.request' && result.ok && isRecord(result.output)) {
          const question = typeof result.output.question === 'string' ? result.output.question : '';
          const rawOptions = result.output.options;
          const options = Array.isArray(rawOptions)
            ? rawOptions.filter((o): o is string => typeof o === 'string')
            : [];

          if (question.length > 0 && options.length > 0) {
            confirmRequest = { question, options };
            return { ok: true, output: result.output, haltSignal: confirmRequest };
          }
        }

        toolCalls.push(toChatToolCall(result));

        if (toolInput.toolName === 'task.create' && result.ok) {
          task = result.output ?? null;
        }

        if (toolInput.toolName === 'project.create' && result.ok) {
          project = result.output ?? null;
        }

        return { ok: result.ok, output: result.output, error: result.error };
      }
    });

    return { reply: loopResult.finalReply, toolCalls, task, project, confirmRequest };
  }

  async prepareAttachments(input: {
    agentAdapterId?: string | null;
    agentModel?: string | null;
    attachments: AdapterChatAttachment[];
    abortSignal?: AbortSignal;
  }): Promise<AdapterChatAttachment[]> {
    const audioAttachments = input.attachments.filter(
      (attachment) => attachment.kind === 'audio' && !attachment.transcript?.trim()
    );

    if (audioAttachments.length === 0) {
      return input.attachments;
    }

    const adapterConfig = await this.resolveAdapterConfig(input.agentAdapterId, input.agentModel);
    if (!adapterConfig) {
      throw new Error('CHAT_AUDIO_TRANSCRIPTION_CONFIG_MISSING');
    }

    const adapter = this.adapterRegistry.get(adapterConfig.adapterId);
    if (!adapter) {
      throw new Error(`ADAPTER_NOT_FOUND:${adapterConfig.adapterId}`);
    }

    if (!adapter.transcribeAudio) {
      throw new Error(`CHAT_AUDIO_TRANSCRIPTION_UNSUPPORTED: active adapter=${adapterConfig.adapterId}, model=${adapterConfig.model}`);
    }
    const transcribeAudio = adapter.transcribeAudio.bind(adapter);

    const transcripts = await Promise.all(
      audioAttachments.map(async (attachment) => ({
        id: attachment.id,
        transcript: (await transcribeAudio({
          apiKey: adapterConfig.apiKey,
          audio: attachment.data,
          mediaType: attachment.mediaType,
          filename: attachment.filename,
          abortSignal: input.abortSignal
        })).text.trim()
      }))
    );

    for (const entry of transcripts) {
      if (entry.transcript.length === 0) {
        throw new Error(`CHAT_AUDIO_TRANSCRIPTION_EMPTY:${entry.id}`);
      }
    }

    const transcriptById = new Map(
      transcripts.map((entry) => [entry.id, entry.transcript])
    );

    return input.attachments.map((attachment) =>
      transcriptById.has(attachment.id)
        ? { ...attachment, transcript: transcriptById.get(attachment.id) }
        : attachment
    );
  }

  private async resolveAdapterConfig(
    agentAdapterId?: string | null,
    agentModel?: string | null
  ): Promise<AdapterConfig | null> {
    const overrideAdapterId = agentAdapterId ? toAdapterId(agentAdapterId) : undefined;

    const [providerSetting, globalApiKeySetting, modelSetting] = await Promise.all([
      this.settingsService.get('provider.name'),
      this.settingsService.get('provider.apiKey'),
      this.settingsService.get('provider.defaultModel')
    ]);

    const adapterId = overrideAdapterId ?? toAdapterId(providerSetting?.value);
    if (!adapterId) {
      return null;
    }

    const model = agentModel ?? asNonEmptyString(modelSetting?.value);
    if (!model) {
      return null;
    }

    const perAdapterKeySetting = await this.settingsService.get(`provider.${adapterId}.apiKey`);
    const apiKey =
      asNonEmptyString(perAdapterKeySetting?.value) ??
      asNonEmptyString(globalApiKeySetting?.value);

    if (!apiKey) {
      return null;
    }

    return { adapterId, apiKey, model };
  }

  async resolveEnabledSkills(): Promise<Array<{ id: string; name: string; description: string }>> {
    if (this.skillsService) {
      const listed = await this.skillsService.list().catch(() => null);
      if (listed) {
        return listed.items
          .filter((skill) => skill.enabled)
          .map((skill) => ({ id: skill.id, name: skill.name, description: skill.description }));
      }
    }

    const setting = await this.settingsService.get('skills.registry').catch(() => null);
    if (!isRecord(setting?.value) || !Array.isArray(setting?.value.enabled)) {
      return [];
    }

    return (setting.value.enabled as unknown[])
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .map((id) => ({ id, name: id, description: 'Enabled local skill' }));
  }
}

function toAdapterId(value: unknown): AdapterId | undefined {
  if (value === 'openai' || value === 'claude') {
    return value;
  }

  if (value === 'anthropic') {
    return 'claude';
  }

  return undefined;
}

const INTERNAL_TOOLS_ALWAYS_ALLOWED = new Set(['confirm.request']);

function filterToolsForAgent(tools: ToolDefinitionSummary[], level: AgentLevel): ToolDefinitionSummary[] {
  const registry = buildAgentSlashRegistry();
  const allowedToolNames = new Set(
    registry
      .listForLevel(level)
      .filter((entry): entry is ToolSlashEntry => entry.kind === 'tool')
      .map((entry) => entry.toolName)
  );

  return tools.filter((tool) => allowedToolNames.has(tool.name) || INTERNAL_TOOLS_ALWAYS_ALLOWED.has(tool.name));
}
