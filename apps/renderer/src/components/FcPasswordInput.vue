<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';

defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: string] }>();

const show = ref(false);
</script>

<template>
  <div class="fc-password-wrap">
    <input
      v-bind="$attrs"
      class="fc-input fc-input-password"
      :value="modelValue"
      :type="show ? 'text' : 'password'"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="fc-password-eye"
      :aria-label="show ? 'Hide value' : 'Show value'"
      @click="show = !show"
    >
      <component :is="show ? EyeOff : Eye" :size="14" />
    </button>
  </div>
</template>
