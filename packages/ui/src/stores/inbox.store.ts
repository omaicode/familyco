import type {
  ApprovalListItem,
  AuditListItem,
  DecideApprovalPayload,
  FamilyCoApiContracts
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface InboxStoreData {
  approvals: ApprovalListItem[];
  auditHighlights: AuditListItem[];
}

export class InboxStore {
  state: AsyncState<InboxStoreData>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<InboxStoreData>({
      approvals: [],
      auditHighlights: []
    });
  }

  async load(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const [approvals, audit] = await Promise.all([
        this.api.listApprovals(),
        this.api.listAudit(20)
      ]);

      this.state.data = {
        approvals,
        auditHighlights: audit
      };
      this.state.isEmpty = approvals.length === 0;
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
}

export const createInboxStore = (api: FamilyCoApiContracts): InboxStore => new InboxStore(api);
