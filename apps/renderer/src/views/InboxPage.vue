<script setup lang="ts">
import { onMounted } from 'vue';

import { uiRuntime } from '../runtime';

const reload = async () => {
  await uiRuntime.stores.inbox.load();
};

const decide = async (approvalId: string, status: 'approved' | 'rejected') => {
  await uiRuntime.stores.inbox.decide({
    approvalId,
    status
  });
};

const markRead = async (id: string) => {
  await uiRuntime.stores.inbox.markRead(id);
};

const archive = async (id: string) => {
  await uiRuntime.stores.inbox.archive({ id });
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
        <p>Review approvals, alerts, and governance actions.</p>
      </div>
      <button class="fc-btn-secondary" @click="reload">Refresh inbox</button>
    </div>

    <div v-if="uiRuntime.stores.inbox.state.isLoading" class="fc-loading">Loading inbox items...</div>

    <div v-else-if="uiRuntime.stores.inbox.state.errorMessage" class="fc-error">
      <p>{{ uiRuntime.stores.inbox.state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="reload">Retry</button>
    </div>

    <div v-else-if="uiRuntime.stores.inbox.state.isEmpty" class="fc-empty">
      <p>Inbox is clear. No pending approvals right now.</p>
    </div>

    <div v-else class="fc-content-two-col" style="margin-top: 0">
      <article class="fc-card">
        <h4>Messages</h4>
        <ul class="fc-list" style="margin-bottom: 12px">
          <li
            v-for="message in uiRuntime.stores.inbox.state.data.messages"
            :key="message.id"
            class="fc-list-item"
          >
            <div>
              <strong>{{ message.title }}</strong>
              <p class="fc-list-meta">{{ message.type }} · {{ message.status }}</p>
              <p class="fc-list-meta">{{ message.body }}</p>
            </div>
            <div style="display: flex; gap: 6px">
              <button class="fc-btn-secondary" @click="markRead(message.id)">Read</button>
              <button class="fc-btn-secondary" @click="archive(message.id)">Archive</button>
            </div>
          </li>
        </ul>
      </article>

      <article class="fc-card">
        <h4>Approvals</h4>
        <ul class="fc-list">
          <li v-for="approval in uiRuntime.stores.inbox.state.data.approvals" :key="approval.id" class="fc-list-item">
            <div>
              <strong>{{ approval.action }}</strong>
              <p class="fc-list-meta">{{ approval.actorId }} · {{ approval.status }}</p>
            </div>
            <div style="display: flex; gap: 6px">
              <button class="fc-btn-primary" @click="decide(approval.id, 'approved')">Approve</button>
              <button class="fc-btn-secondary" @click="decide(approval.id, 'rejected')">Reject</button>
            </div>
          </li>
        </ul>
      </article>

      <article class="fc-card">
        <h4>Audit highlights</h4>
        <ul class="fc-list">
          <li v-for="item in uiRuntime.stores.inbox.state.data.auditHighlights" :key="item.id" class="fc-list-item">
            <div>
              <strong>{{ item.action }}</strong>
              <p class="fc-list-meta">{{ item.actorType }} · {{ item.createdAt }}</p>
            </div>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
