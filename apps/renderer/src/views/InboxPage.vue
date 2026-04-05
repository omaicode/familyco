<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';

type ApprovalDecision = 'approved' | 'rejected';

const approvalFilter = ref<'pending' | 'all'>('pending');
const messageFilter = ref<'all' | 'unread' | 'approval' | 'alert' | 'report' | 'info'>('all');
const selectedApprovalIds = ref<string[]>([]);
const decisionBusy = ref<Record<string, boolean>>({});
const messageBusy = ref<Record<string, boolean>>({});
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const requestInfoOpen = ref(false);
const requestInfoTargetId = ref<string | null>(null);
const requestInfoNote = ref('');

const reload = async () => {
  feedback.value = null;
  selectedApprovalIds.value = [];
  await uiRuntime.stores.inbox.load();
};

const approvals = computed(() => uiRuntime.stores.inbox.state.data.approvals);
const messages = computed(() => uiRuntime.stores.inbox.state.data.messages);
const auditHighlights = computed(() => uiRuntime.stores.inbox.state.data.auditHighlights);

const filteredApprovals = computed(() => {
  if (approvalFilter.value === 'all') {
    return approvals.value;
  }

  return approvals.value.filter((approval) => approval.status === 'pending');
});

const filteredMessages = computed(() => {
  if (messageFilter.value === 'all') {
    return messages.value;
  }

  if (messageFilter.value === 'unread') {
    return messages.value.filter((message) => message.status === 'unread');
  }

  return messages.value.filter((message) => message.type === messageFilter.value);
});

const pendingApprovalIds = computed(() =>
  filteredApprovals.value.filter((approval) => approval.status === 'pending').map((approval) => approval.id)
);

const canBulkDecide = computed(() => selectedApprovalIds.value.length > 0);

const isBusy = (map: Record<string, boolean>, id: string): boolean => map[id] === true;

const markBusy = (mapRef: typeof decisionBusy | typeof messageBusy, id: string, value: boolean): void => {
  mapRef.value = {
    ...mapRef.value,
    [id]: value
  };
};

const inferRisk = (action: string): 'low' | 'medium' | 'high' => {
  const normalized = action.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('archive') || normalized.includes('revoke')) {
    return 'high';
  }

  if (normalized.includes('update') || normalized.includes('move') || normalized.includes('assign')) {
    return 'medium';
  }

  return 'low';
};

const performDecision = async (
  approvalId: string,
  status: ApprovalDecision,
  note?: string
): Promise<void> => {
  markBusy(decisionBusy, approvalId, true);
  feedback.value = null;

  try {
    await uiRuntime.stores.inbox.decide({
      approvalId,
      status,
      note
    });
    feedback.value = {
      type: 'success',
      text: `Decision saved for ${approvalId.slice(0, 8)}`
    };
  } catch (error) {
    feedback.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to submit decision'
    };
  } finally {
    markBusy(decisionBusy, approvalId, false);
  }
};

const decide = async (approvalId: string, status: ApprovalDecision) => {
  await performDecision(approvalId, status);
};

const openRequestInfo = (approvalId: string): void => {
  requestInfoTargetId.value = approvalId;
  requestInfoNote.value = '';
  requestInfoOpen.value = true;
};

const closeRequestInfo = (): void => {
  requestInfoOpen.value = false;
  requestInfoTargetId.value = null;
  requestInfoNote.value = '';
};

const submitRequestInfo = async (): Promise<void> => {
  if (!requestInfoTargetId.value || requestInfoNote.value.trim().length === 0) {
    return;
  }

  await performDecision(
    requestInfoTargetId.value,
    'rejected',
    `REQUEST_MORE_INFO: ${requestInfoNote.value.trim()}`
  );

  closeRequestInfo();
};

const toggleSelectAllPending = (): void => {
  const allPending = pendingApprovalIds.value;
  const hasAllSelected = allPending.length > 0 && allPending.every((id) => selectedApprovalIds.value.includes(id));
  selectedApprovalIds.value = hasAllSelected ? [] : [...allPending];
};

const toggleApprovalSelection = (approvalId: string): void => {
  if (selectedApprovalIds.value.includes(approvalId)) {
    selectedApprovalIds.value = selectedApprovalIds.value.filter((id) => id !== approvalId);
    return;
  }

  selectedApprovalIds.value = [...selectedApprovalIds.value, approvalId];
};

const bulkDecide = async (status: ApprovalDecision): Promise<void> => {
  if (!canBulkDecide.value) {
    return;
  }

  const ids = [...selectedApprovalIds.value];
  await Promise.all(ids.map(async (id) => performDecision(id, status)));
  selectedApprovalIds.value = [];
};

const markRead = async (id: string) => {
  markBusy(messageBusy, id, true);
  feedback.value = null;
  try {
    await uiRuntime.stores.inbox.markRead(id);
  } catch (error) {
    feedback.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to mark message as read'
    };
  } finally {
    markBusy(messageBusy, id, false);
  }
};

const archive = async (id: string) => {
  markBusy(messageBusy, id, true);
  feedback.value = null;
  try {
    await uiRuntime.stores.inbox.archive({ id });
  } catch (error) {
    feedback.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Failed to archive message'
    };
  } finally {
    markBusy(messageBusy, id, false);
  }
};

onMounted(async () => {
  await reload();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Master Inbox</h3>
        <p>Triage decisions quickly with risk context and bulk approval controls.</p>
      </div>
      <button class="fc-btn-secondary" @click="reload">Refresh inbox</button>
    </div>

    <div v-if="feedback" :class="feedback.type === 'success' ? 'fc-banner-success' : 'fc-banner-error'">
      {{ feedback.text }}
    </div>

    <div v-if="uiRuntime.stores.inbox.state.isLoading" class="fc-loading"><SkeletonList /></div>

    <div v-else-if="uiRuntime.stores.inbox.state.errorMessage" class="fc-error">
      <p>{{ uiRuntime.stores.inbox.state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="reload">Retry</button>
    </div>

    <div v-else-if="uiRuntime.stores.inbox.state.isEmpty" class="fc-empty">
      <p>Inbox is clear. No pending approvals right now.</p>
    </div>

    <div v-else class="fc-content-two-col" style="margin-top: 0">
      <article class="fc-card">
        <div class="fc-page-header" style="margin-bottom: 10px">
          <h4 style="margin: 0">Messages</h4>
          <select v-model="messageFilter" class="fc-select" style="max-width: 180px">
            <option value="all">All types</option>
            <option value="unread">Unread only</option>
            <option value="approval">Approvals</option>
            <option value="alert">Alerts</option>
            <option value="report">Reports</option>
            <option value="info">Info</option>
          </select>
        </div>
        <ul class="fc-list" style="margin-bottom: 12px">
          <li v-for="message in filteredMessages" :key="message.id" class="fc-list-item">
            <div>
              <strong>{{ message.title }}</strong>
              <p class="fc-list-meta">{{ message.type }} · {{ message.status }}</p>
              <p class="fc-list-meta">{{ message.body }}</p>
            </div>
            <div style="display: flex; gap: 6px">
              <button
                class="fc-btn-secondary"
                :disabled="isBusy(messageBusy, message.id)"
                @click="markRead(message.id)"
              >
                {{ isBusy(messageBusy, message.id) ? 'Saving...' : 'Read' }}
              </button>
              <button
                class="fc-btn-secondary"
                :disabled="isBusy(messageBusy, message.id)"
                @click="archive(message.id)"
              >
                {{ isBusy(messageBusy, message.id) ? 'Saving...' : 'Archive' }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="filteredMessages.length === 0" class="fc-list-meta" style="margin: 0">
          No messages match current filter.
        </p>
      </article>

      <article class="fc-card">
        <div class="fc-page-header" style="margin-bottom: 10px">
          <div>
            <h4 style="margin: 0">Approvals</h4>
            <p class="fc-list-meta" style="margin: 4px 0 0">Bulk actions are available for selected rows.</p>
          </div>
          <select v-model="approvalFilter" class="fc-select" style="max-width: 180px">
            <option value="pending">Pending only</option>
            <option value="all">All statuses</option>
          </select>
        </div>

        <div class="fc-inline-actions" style="margin-bottom: 10px">
          <button class="fc-btn-secondary" @click="toggleSelectAllPending">Select pending</button>
          <button class="fc-btn-primary" :disabled="!canBulkDecide" @click="bulkDecide('approved')">
            Bulk approve
          </button>
          <button class="fc-btn-secondary" :disabled="!canBulkDecide" @click="bulkDecide('rejected')">
            Bulk reject
          </button>
        </div>

        <ul class="fc-list">
          <li v-for="approval in filteredApprovals" :key="approval.id" class="fc-list-item">
            <div>
              <strong>{{ approval.action }}</strong>
              <p class="fc-list-meta">
                {{ approval.actorId }} · {{ approval.targetType || 'operation' }} · {{ approval.status }}
              </p>
              <p class="fc-list-meta" style="margin-top: 2px">
                Risk: <span class="fc-risk-tag" :data-risk="inferRisk(approval.action)">{{ inferRisk(approval.action) }}</span>
              </p>
            </div>
            <div style="display: flex; gap: 6px">
              <input
                v-if="approval.status === 'pending'"
                :checked="selectedApprovalIds.includes(approval.id)"
                aria-label="Select approval"
                type="checkbox"
                @change="toggleApprovalSelection(approval.id)"
              />
              <button
                class="fc-btn-primary"
                :disabled="approval.status !== 'pending' || isBusy(decisionBusy, approval.id)"
                @click="decide(approval.id, 'approved')"
              >
                {{ isBusy(decisionBusy, approval.id) ? 'Saving...' : 'Approve' }}
              </button>
              <button
                class="fc-btn-secondary"
                :disabled="approval.status !== 'pending' || isBusy(decisionBusy, approval.id)"
                @click="decide(approval.id, 'rejected')"
              >
                Reject
              </button>
              <button
                class="fc-btn-secondary"
                :disabled="approval.status !== 'pending' || isBusy(decisionBusy, approval.id)"
                @click="openRequestInfo(approval.id)"
              >
                Need info
              </button>
            </div>
          </li>
        </ul>
        <p v-if="filteredApprovals.length === 0" class="fc-list-meta" style="margin: 0">
          No approvals match current filter.
        </p>
      </article>

      <article class="fc-card">
        <h4>Audit highlights</h4>
        <ul class="fc-list">
          <li v-for="item in auditHighlights" :key="item.id" class="fc-list-item">
            <div>
              <strong>{{ item.action }}</strong>
              <p class="fc-list-meta">{{ item.actorId }} · {{ item.createdAt }}</p>
            </div>
          </li>
        </ul>
      </article>

      <article v-if="requestInfoOpen" class="fc-card" @keydown.esc="closeRequestInfo">
        <h4>Request more info</h4>
        <p class="fc-list-meta">Send clarification request before final approval decision.</p>
        <textarea
          v-model="requestInfoNote"
          class="fc-input"
          rows="4"
          placeholder="Explain what information is missing"
          @keydown.enter.exact.prevent="submitRequestInfo"
        />
        <div class="fc-inline-actions" style="margin-top: 10px">
          <button class="fc-btn-secondary" @click="closeRequestInfo">Cancel</button>
          <button class="fc-btn-primary" :disabled="requestInfoNote.trim().length === 0" @click="submitRequestInfo">
            Send request
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
