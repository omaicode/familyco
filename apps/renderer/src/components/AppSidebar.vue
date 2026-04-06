<script setup lang="ts">
import type { Component } from 'vue';
import { RouterLink } from 'vue-router';
import { Zap, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';

interface NavItem {
  path: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const props = defineProps<{
  collapsed: boolean;
  mobileOpen: boolean;
  navGroups: NavGroup[];
  navIcons: Record<string, Component>;
  pendingInboxCount: number;
}>();

const emit = defineEmits<{
  toggle: [];
  closeMobile: [];
}>();
</script>

<template>
  <!-- Mobile overlay -->
  <div
    v-if="props.mobileOpen"
    class="fc-sidebar-overlay"
    @click="emit('closeMobile')"
  ></div>

  <!-- Sidebar -->
  <aside
    class="fc-sidebar"
    :class="{
      collapsed: props.collapsed,
      'mobile-open': props.mobileOpen,
    }"
  >
    <!-- Brand -->
    <div class="fc-brand">
      <div class="fc-brand-logo">
        <Zap :size="18" />
      </div>
      <div class="fc-brand-text">
        <h1>FamilyCo</h1>
        <p>AI Operating System</p>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="fc-nav" aria-label="Main navigation">
      <template v-for="group in props.navGroups" :key="group.label">
        <span class="fc-nav-section-label">{{ group.label }}</span>
        <div
          v-for="section in group.items"
          :key="section.path"
          class="fc-nav-item-wrap"
        >
          <RouterLink
            :to="section.path"
            class="fc-nav-item"
            active-class="fc-nav-item-active"
            :data-tooltip="section.label"
          >
            <component
              :is="props.navIcons[section.path]"
              :size="18"
              class="fc-nav-item-icon"
            />
            <span class="fc-nav-label">{{ section.label }}</span>
          </RouterLink>
          <!-- Pending approval badge on Inbox -->
          <span
            v-if="section.path === '/inbox' && props.pendingInboxCount > 0"
            class="fc-nav-badge"
          >{{ props.pendingInboxCount > 99 ? '99+' : props.pendingInboxCount }}</span>
        </div>
      </template>
    </nav>

    <!-- Footer / collapse button -->
    <div class="fc-nav-footer">
      <button
        class="fc-sidebar-collapse-btn"
        :title="props.collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="emit('toggle')"
      >
        <component
          :is="props.collapsed ? PanelLeftOpen : PanelLeftClose"
          :size="16"
        />
        <span>Collapse</span>
      </button>
    </div>
  </aside>
</template>
