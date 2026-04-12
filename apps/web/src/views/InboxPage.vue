<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  RefreshCw, Inbox, MessageSquare, ShieldCheck, CheckCircle2, XCircle,
  HelpCircle, Check, X, Archive, BookOpen, ChevronDown, AlertTriangle,
  Bell, FileText, Info, Trash2
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import { useI18n } from '../composables/useI18n';

type ApprovalDecision = 'approved' | 'rejected';

// ── State ──────────────────────────────────────────────────
const { t } = useI18n();

const approvalFilter = ref<'pending' | 'all'>('pending');
const messageFilter = ref<'all' | 'unread' | 'approval' | 'alert' | 'report' | 'info'>('all');
const selectedApprovalIds = ref<string[]>([]);
const decisionBusy = ref<Record<string, boolean>>({});
const messageBusy = ref<Record<string, boolean>>({});
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);
const activeTab = ref<'approvals' | 'messages' | 'audit'>('approvals');
const isLoading = ref(false);

const requestInfoOpen = ref(false);
const requestInfoTargetId = ref<string | null>(null);
const requestInfoNote = ref('');

const reload = async () => {
  feedback.value = null;
  selectedApprovalIds.value = [];
  isLoading.value = true;
  try {
    await uiRuntime.stores.inbox.load();
  } finally {
    isLoading.value = false;
  }
};

// ── Computed ────────────────────────────────────────────────
const approvals = computed(() => uiRuntime.stores.inbox.state.data.approvals);
const messages = computed(() => uiRuntime.stores.inbox.state.data.messages);
const auditHighlights = computed(() => uiRuntime.stores.inbox.state.data.auditHighlights);

const filteredApprovals = computed(() => {
  if (approvalFilter.value === 'all') return approvals.value;
  return approvals.value.filter(a => a.status === 'pending');
});

const filteredMessages = computed(() => {
  if (messageFilter.value === 'all') return messages.value;
  if (messageFilter.value === 'unread') return messages.value.filter(m => m.status === 'unread');
  return messages.value.filter(m => m.type === messageFilter.value);
});

const pendingApprovalIds = computed(() =>
  filteredApprovals.value.filter(a => a.status === 'pending').map(a => a.id)
);

const pendingCount = computed(() => approvals.value.filter(a => a.status === 'pending').length);
const unreadCount  = computed(() => messages.value.filter(m => m.status === 'unread').length);
const canBulkDecide = computed(() => selectedApprovalIds.value.length > 0);

const isBusy = (map: Record<string, boolean>, id: string) => map[id] === true;
const markBusy = (mapRef: typeof decisionBusy | typeof messageBusy, id: string, value: boolean) => {
  mapRef.value = { ...mapRef.value, [id]: value };
};

const inferRisk = (action: string): 'low' | 'medium' | 'high' => {
  const n = action.toLowerCase();
  if (n.includes('delete') || n.includes('archive') || n.includes('revoke')) return 'high';
  if (n.includes('update') || n.includes('move') || n.includes('assign')) return 'medium';
  return 'low';
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)    return t('just now');
  if (diff < 3600_000)  return t('{{count}}m ago', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('{{count}}h ago', { count: Math.floor(diff / 3600_000) });
  return d.toLocaleDateString();
};

// ── Actions ─────────────────────────────────────────────────
const setFeedback = (type: 'success' | 'error', text: string) => {
  feedback.value = { type, text };
  setTimeout(() => { if (feedback.value?.text === text) feedback.value = null; }, 4000);
};

const performDecision = async (approvalId: string, status: ApprovalDecision, note?: string) => {
  markBusy(decisionBusy, approvalId, true);
  feedback.value = null;
  try {
    await uiRuntime.stores.inbox.decide({ approvalId, status, note });
    setFeedback('success', `Decision recorded — ${status}`);
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to submit decision');
  } finally {
    markBusy(decisionBusy, approvalId, false);
  }
};

const decide = (approvalId: string, status: ApprovalDecision) => performDecision(approvalId, status);

const openRequestInfo = (approvalId: string) => {
  requestInfoTargetId.value = approvalId;
  requestInfoNote.value = '';
  requestInfoOpen.value = true;
};

const closeRequestInfo = () => {
  requestInfoOpen.value = false;
  requestInfoTargetId.value = null;
  requestInfoNote.value = '';
};

const submitRequestInfo = async () => {
  if (!requestInfoTargetId.value || !requestInfoNote.value.trim()) return;
  await performDecision(requestInfoTargetId.value, 'rejected', `REQUEST_MORE_INFO: ${requestInfoNote.value.trim()}`);
  closeRequestInfo();
};

const toggleSelectAllPending = () => {
  const allPending = pendingApprovalIds.value;
  const hasAll = allPending.length > 0 && allPending.every(id => selectedApprovalIds.value.includes(id));
  selectedApprovalIds.value = hasAll ? [] : [...allPending];
};

const toggleSelect = (id: string) => {
  selectedApprovalIds.value = selectedApprovalIds.value.includes(id)
    ? selectedApprovalIds.value.filter(i => i !== id)
    : [...selectedApprovalIds.value, id];
};

const bulkDecide = async (status: ApprovalDecision) => {
  if (!canBulkDecide.value) return;
  const ids = [...selectedApprovalIds.value];
  await Promise.all(ids.map(id => performDecision(id, status)));
  selectedApprovalIds.value = [];
};

const markRead = async (id: string) => {
  markBusy(messageBusy, id, true);
  try {
    await uiRuntime.stores.inbox.markRead(id);
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to mark as read');
  } finally {
    markBusy(messageBusy, id, false);
  }
};

const archive = async (id: string) => {
  markBusy(messageBusy, id, true);
  try {
    await uiRuntime.stores.inbox.archive({ id });
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to archive');
  } finally {
    markBusy(messageBusy, id, false);
  }
};

const requestChange = async (id: string) => {
  const responseText = window.prompt(t('Describe the requested changes'))?.trim();
  if (!responseText) {
    return;
  }

  markBusy(messageBusy, id, true);
  try {
    await uiRuntime.stores.inbox.requestChange({ id, responseText });
    setFeedback('success', t('Change request sent'));
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('Failed to send change request'));
  } finally {
    markBusy(messageBusy, id, false);
  }
};

const answerClarification = async (id: string) => {
  const responseText = window.prompt(t('Provide clarification response'))?.trim();
  if (!responseText) {
    return;
  }

  markBusy(messageBusy, id, true);
  try {
    await uiRuntime.stores.inbox.answerClarification({ id, responseText });
    setFeedback('success', t('Clarification sent'));
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('Failed to send clarification'));
  } finally {
    markBusy(messageBusy, id, false);
  }
};

useAutoReload(reload);
</script>

<template>
  <section>
    <!-- ── Header ──────────────────────────────────── -->
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Inbox') }}</h3>
        <p>{{ t('Review approvals, task updates, and governance highlights.') }}</p>
      </div>
      <button class="fc-btn-secondary" :disabled="isLoading" @click="reload">
        <RefreshCw :size="14" :class="{ 'fc-spin': isLoading }" />
        {{ t('Refresh') }}
      </button>
    </div>

    <!-- ── Feedback banner ─────────────────────────── -->
    <Transition name="fc-banner">
      <div
        v-if="feedback"
        class="fc-banner"
        :class="feedback.type === 'success' ? 'fc-banner-success' : 'fc-banner-error'"
        style="margin-bottom:12px;"
      >
        <component :is="feedback.type === 'success' ? CheckCircle2 : XCircle" :size="15" style="flex-shrink:0;" />
        <span>{{ feedback.text }}</span>
      </div>
    </Transition>

    <!-- ── Loading ──────────────────────────────────── -->
    <div v-if="isLoading" class="fc-loading">
      <p style="margin:0 0 12px;font-size:0.875rem;color:var(--fc-text-muted);">{{ t('Loading inbox…') }}</p>
      <SkeletonList />
    </div>

    <!-- ── Error ────────────────────────────────────── -->
    <div v-else-if="uiRuntime.stores.inbox.state.errorMessage" class="fc-error">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <AlertTriangle :size="16" />
        <p style="margin:0;">{{ uiRuntime.stores.inbox.state.errorMessage }}</p>
      </div>
      <button class="fc-btn-secondary fc-btn-sm" @click="reload">
        <RefreshCw :size="13" /> {{ t('Retry') }}
      </button>
    </div>

    <!-- ── Empty ────────────────────────────────────── -->
    <div v-else-if="uiRuntime.stores.inbox.state.isEmpty" class="fc-empty">
      <Inbox :size="36" class="fc-empty-icon" />
      <h4>{{ t('All clear') }}</h4>
      <p>{{ t('No pending approvals or messages right now.') }}</p>
    </div>

    <template v-else>
      <!-- ── Tab nav ───────────────────────────────── -->
      <div class="fc-tabs" style="margin-bottom:16px;">
        <button
          class="fc-tab"
          :class="{ 'fc-tab-active': activeTab === 'approvals' }"
          @click="activeTab = 'approvals'"
        >
          <ShieldCheck :size="14" />
          {{ t('Approvals') }}
          <span class="fc-tab-count">{{ pendingCount }}</span>
        </button>
        <button
          class="fc-tab"
          :class="{ 'fc-tab-active': activeTab === 'messages' }"
          @click="activeTab = 'messages'"
        >
          <MessageSquare :size="14" />
          {{ t('Task updates') }}
          <span v-if="unreadCount > 0" class="fc-tab-count">{{ unreadCount }}</span>
        </button>
        <button
          class="fc-tab"
          :class="{ 'fc-tab-active': activeTab === 'audit' }"
          @click="activeTab = 'audit'"
        >
          <BookOpen :size="14" />
          Audit highlights
        </button>
      </div>

      <!-- ── Approvals tab ─────────────────────────── -->
      <div v-show="activeTab === 'approvals'">
        <!-- Toolbar -->
        <div class="fc-toolbar" style="margin-bottom:12px;">
          <div class="fc-tabs" style="margin-bottom:0;">
            <button class="fc-tab" :class="{ 'fc-tab-active': approvalFilter === 'pending' }" @click="approvalFilter = 'pending'">
              Pending
            </button>
            <button class="fc-tab" :class="{ 'fc-tab-active': approvalFilter === 'all' }" @click="approvalFilter = 'all'">
              All
            </button>
          </div>
          <div class="fc-toolbar-spacer"></div>
          <button class="fc-btn-ghost fc-btn-sm" @click="toggleSelectAllPending">
            <Check :size="13" />
            {{ selectedApprovalIds.length === pendingApprovalIds.length && pendingApprovalIds.length > 0 ? 'Deselect all' : 'Select all' }}
          </button>
          <button
            class="fc-btn-primary fc-btn-sm"
            :disabled="!canBulkDecide"
            @click="bulkDecide('approved')"
          >
            <CheckCircle2 :size="13" />
            Approve ({{ selectedApprovalIds.length }})
          </button>
          <button
            class="fc-btn-danger fc-btn-sm"
            :disabled="!canBulkDecide"
            @click="bulkDecide('rejected')"
          >
            <XCircle :size="13" />
            Reject ({{ selectedApprovalIds.length }})
          </button>
        </div>

        <!-- Need info modal -->
        <Transition name="fc-page">
          <div
            v-if="requestInfoOpen"
            class="fc-card fc-banner-info"
            style="margin-bottom:12px;padding:16px;"
            @keydown.esc="closeRequestInfo"
          >
            <div class="fc-section-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <HelpCircle :size="16" style="color:var(--fc-info);" />
                <h4 style="margin:0;font-size:0.9rem;">Request more information</h4>
              </div>
              <button class="fc-btn-ghost fc-btn-icon" @click="closeRequestInfo">
                <X :size="14" />
              </button>
            </div>
            <textarea
              v-model="requestInfoNote"
              class="fc-textarea"
              placeholder="Describe what information you need from the agent…"
              style="margin-bottom:10px;"
              rows="3"
              autofocus
              @keydown.enter.ctrl="submitRequestInfo"
            ></textarea>
            <div class="fc-inline-actions">
              <button
                class="fc-btn-primary fc-btn-sm"
                :disabled="!requestInfoNote.trim()"
                @click="submitRequestInfo"
              >
                <HelpCircle :size="13" /> Send request
              </button>
              <button class="fc-btn-ghost fc-btn-sm" @click="closeRequestInfo">
                Cancel
              </button>
              <span class="fc-list-meta">Ctrl+Enter to send</span>
            </div>
          </div>
        </Transition>

        <!-- Approvals list -->
        <div v-if="filteredApprovals.length > 0" style="display:flex;flex-direction:column;gap:8px;">
          <div
            v-for="approval in filteredApprovals"
            :key="approval.id"
            class="fc-approval-card"
            :data-status="approval.status"
          >
            <div class="fc-approval-card-header">
              <input
                v-if="approval.status === 'pending'"
                type="checkbox"
                class="fc-checkbox"
                :checked="selectedApprovalIds.includes(approval.id)"
                :aria-label="`Select ${approval.action}`"
                @change="toggleSelect(approval.id)"
              />
              <span
                v-else
                style="width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"
              >
                <component
                  :is="approval.status === 'approved' ? CheckCircle2 : XCircle"
                  :size="14"
                  :style="{ color: approval.status === 'approved' ? 'var(--fc-success)' : 'var(--fc-error)' }"
                />
              </span>

              <div class="fc-approval-card-meta">
                <strong>{{ approval.action }}</strong>
                <p>{{ approval.actorId }} · {{ approval.targetType || 'operation' }}</p>
              </div>

              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                <span class="fc-risk-tag" :data-risk="inferRisk(approval.action)">
                  {{ inferRisk(approval.action) }}
                </span>
                <span class="fc-badge" :data-status="approval.status">{{ approval.status }}</span>
              </div>
            </div>

            <div v-if="approval.status === 'pending'" class="fc-approval-card-actions">
              <button
                class="fc-btn-primary fc-btn-sm"
                :disabled="isBusy(decisionBusy, approval.id)"
                @click="decide(approval.id, 'approved')"
              >
                <Check :size="12" />
                {{ isBusy(decisionBusy, approval.id) ? 'Saving…' : 'Approve' }}
              </button>
              <button
                class="fc-btn-danger fc-btn-sm"
                :disabled="isBusy(decisionBusy, approval.id)"
                @click="decide(approval.id, 'rejected')"
              >
                <X :size="12" />
                Reject
              </button>
              <button
                class="fc-btn-ghost fc-btn-sm"
                :disabled="isBusy(decisionBusy, approval.id)"
                @click="openRequestInfo(approval.id)"
              >
                <HelpCircle :size="12" />
                Need info
              </button>
            </div>
          </div>
        </div>

        <div v-else class="fc-empty" style="padding:32px;">
          <CheckCircle2 :size="32" class="fc-empty-icon" />
          <h4>All caught up</h4>
          <p>No approvals match your current filter.</p>
          <button v-if="approvalFilter !== 'all'" class="fc-btn-secondary fc-btn-sm" @click="approvalFilter = 'all'">
            Show all
          </button>
        </div>
      </div>

      <!-- ── Messages tab ──────────────────────────── -->
      <div v-show="activeTab === 'messages'">
        <div class="fc-toolbar" style="margin-bottom:12px;">
          <div class="fc-tabs" style="margin-bottom:0;flex-wrap:wrap;">
            <button
              v-for="f in ['all','unread','approval','alert','report','info'] as const"
              :key="f"
              class="fc-tab"
              :class="{ 'fc-tab-active': messageFilter === f }"
              @click="messageFilter = f"
            >
              {{ f.charAt(0).toUpperCase() + f.slice(1) }}
            </button>
          </div>
        </div>

        <div v-if="filteredMessages.length > 0" style="display:flex;flex-direction:column;gap:8px;">
          <div
            v-for="message in filteredMessages"
            :key="message.id"
            class="fc-message-card"
            :data-unread="message.status === 'unread'"
          >
            <div class="fc-message-card-header">
              <span class="fc-message-type-tag">{{ message.type }}</span>
              <span class="fc-badge" :data-status="message.status">{{ message.status }}</span>
              <span class="fc-toolbar-spacer"></span>
              <span class="fc-list-meta" style="margin:0;"><!-- timestamp would go here --></span>
            </div>
            <strong style="display:block;font-size:0.875rem;margin-bottom:4px;">{{ message.title }}</strong>
            <p class="fc-list-meta" style="margin:0 0 10px;">{{ message.body }}</p>
            <div class="fc-list-actions">
              <button
                class="fc-btn-ghost fc-btn-sm"
                :disabled="isBusy(messageBusy, message.id)"
                @click="markRead(message.id)"
              >
                <BookOpen :size="12" />
                {{ isBusy(messageBusy, message.id) ? 'Saving…' : 'Mark read' }}
              </button>
              <button
                class="fc-btn-ghost fc-btn-sm"
                :disabled="isBusy(messageBusy, message.id)"
                @click="archive(message.id)"
              >
                <Archive :size="12" />
                Archive
              </button>
              <button
                v-if="message.type === 'approval'"
                class="fc-btn-ghost fc-btn-sm"
                :disabled="isBusy(messageBusy, message.id)"
                @click="requestChange(message.id)"
              >
                <FileText :size="12" />
                Request change
              </button>
              <button
                v-if="message.type === 'approval'"
                class="fc-btn-ghost fc-btn-sm"
                :disabled="isBusy(messageBusy, message.id)"
                @click="answerClarification(message.id)"
              >
                <Info :size="12" />
                Clarify
              </button>
            </div>
          </div>
        </div>

        <div v-else class="fc-empty" style="padding:32px;">
          <MessageSquare :size="32" class="fc-empty-icon" />
          <h4>No messages</h4>
          <p>No messages match the selected filter.</p>
        </div>
      </div>

      <!-- ── Audit tab ─────────────────────────────── -->
      <div v-show="activeTab === 'audit'">
        <div v-if="auditHighlights.length > 0" style="display:flex;flex-direction:column;gap:6px;">
          <div
            v-for="item in auditHighlights"
            :key="item.id"
            class="fc-list-item"
            style="background:var(--fc-surface);border-radius:var(--fc-card-radius);"
          >
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
              <div style="width:32px;height:32px;border-radius:8px;background:color-mix(in srgb,var(--fc-info) 10%,var(--fc-surface));display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <ShieldCheck :size="14" style="color:var(--fc-info);" />
              </div>
              <div class="fc-list-item-content">
                <strong>{{ item.action }}</strong>
                <p class="fc-list-meta">{{ item.actorId }}</p>
              </div>
            </div>
            <span class="fc-badge" style="background:color-mix(in srgb,var(--fc-info) 10%,var(--fc-surface));border-color:color-mix(in srgb,var(--fc-info) 30%,var(--fc-border-subtle));color:var(--fc-info);">
              audit
            </span>
          </div>
        </div>
        <div v-else class="fc-empty" style="padding:32px;">
          <ShieldCheck :size="32" class="fc-empty-icon" />
          <h4>No audit highlights</h4>
          <p>Recent governance events will appear here.</p>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
.fc-spin { animation: spin 1s linear infinite; }

.fc-banner-enter-active { animation: fc-banner-in 0.25s ease; }
.fc-banner-leave-active { transition: opacity 0.2s ease; }
.fc-banner-leave-to    { opacity: 0; }
@keyframes fc-banner-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
</style>
