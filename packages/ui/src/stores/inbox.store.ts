import type {
  ApprovalListItem,
  ArchiveInboxMessagePayload,
  AuditListItem,
  DecideApprovalPayload,
  FamilyCoApiContracts,
  RespondInboxMessagePayload
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface InboxStoreData {
  approvals: ApprovalListItem[];
  auditHighlights: AuditListItem[];
  messages: Array<{
    id: string;
    recipientId: string;
    senderId: string;
    type: 'approval' | 'report' | 'alert' | 'info';
    title: string;
    body: string;
    status: 'unread' | 'read' | 'archived';
    createdAt: string;
  }>;
}

export class InboxStore {
  state: AsyncState<InboxStoreData>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<InboxStoreData>({
      approvals: [],
      auditHighlights: [],
      messages: []
    });
  }

  async load(recipientId = 'founder'): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const [approvals, audit, messages] = await Promise.all([
        this.api.listApprovals(),
        this.api.listAudit({ limit: 20 }),
        this.api.listInbox(recipientId)
      ]);

      this.state.data = {
        approvals,
        auditHighlights: audit,
        messages
      };
      this.state.isEmpty = approvals.length === 0 && messages.length === 0;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to load inbox';
    } finally {
      this.state.isLoading = false;
    }
  }

  async decide(payload: DecideApprovalPayload): Promise<ApprovalListItem> {
    const updated = await this.api.decideApproval(payload);
    this.state.data.approvals = this.state.data.approvals.map((approval) =>
      approval.id === updated.id ? updated : approval
    );
    return updated;
  }

  async markRead(id: string): Promise<void> {
    const updated = await this.api.readInboxMessage({ id });
    this.state.data.messages = this.state.data.messages.map((message) =>
      message.id === updated.id ? updated : message
    );
  }

  async archive(payload: ArchiveInboxMessagePayload): Promise<void> {
    const updated = await this.api.archiveInboxMessage(payload);
    this.state.data.messages = this.state.data.messages.map((message) =>
      message.id === updated.id ? updated : message
    );
  }

  async requestChange(payload: RespondInboxMessagePayload): Promise<void> {
    const updated = await this.api.requestInboxChange(payload);
    this.state.data.messages = this.state.data.messages.map((message) =>
      message.id === updated.id ? updated : message
    );
  }

  async answerClarification(payload: RespondInboxMessagePayload): Promise<void> {
    const updated = await this.api.answerInboxClarification(payload);
    this.state.data.messages = this.state.data.messages.map((message) =>
      message.id === updated.id ? updated : message
    );
  }
}

export const createInboxStore = (api: FamilyCoApiContracts): InboxStore => new InboxStore(api);
