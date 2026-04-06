<script setup lang="ts">
defineProps<{
  selectedAutonomy: {
    label: string;
    description: string;
    note: string;
  };
  deploymentChecklist: Array<{
    title: string;
    text: string;
    done: boolean;
  }>;
}>();
</script>

<template>
  <div class="ag-stack">
    <div class="ag-note-box">
      <div class="ag-note-head">
        <strong>{{ selectedAutonomy.label }}</strong>
      </div>
      <p>{{ selectedAutonomy.description }}</p>
      <small>{{ selectedAutonomy.note }}</small>
    </div>

    <div class="ag-checklist">
      <div v-for="item in deploymentChecklist" :key="item.title" class="ag-checklist-item">
        <span class="ag-check-dot" :data-done="item.done"></span>
        <div>
          <strong>{{ item.title }}</strong>
          <p>{{ item.text }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ag-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ag-note-box {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--fc-info) 26%, var(--fc-border-subtle));
  border-radius: var(--fc-card-radius);
  background: color-mix(in srgb, var(--fc-info) 6%, var(--fc-surface));
}

.ag-note-head {
  margin-bottom: 6px;
  color: var(--fc-text-main);
}

.ag-note-box p {
  margin: 0 0 6px;
  font-size: 0.82rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
}

.ag-note-box small {
  display: block;
  color: var(--fc-text-muted);
  font-size: 0.74rem;
}

.ag-checklist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ag-checklist-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.ag-check-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-top: 5px;
  flex-shrink: 0;
  background: var(--fc-warning);
}

.ag-check-dot[data-done='true'] {
  background: var(--fc-success);
}

.ag-checklist-item strong {
  display: block;
  font-size: 0.82rem;
  margin-bottom: 3px;
}

.ag-checklist-item p {
  margin: 0;
  font-size: 0.76rem;
  color: var(--fc-text-muted);
  line-height: 1.45;
}
</style>
