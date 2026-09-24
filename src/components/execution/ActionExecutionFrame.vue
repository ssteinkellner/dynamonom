<script setup lang="ts">
defineProps<{
  actionName: string;
  progressLabel: string;
  message: string;
}>();
</script>

<template>
  <section class="view" aria-labelledby="execution-title">
    <header v-if="progressLabel" class="view-header">
      <p class="eyebrow action-progress">
        {{ progressLabel }}
      </p>
    </header>
    <p v-if="message" class="status error-status" role="alert" aria-live="polite">
      {{ message }}
    </p>
    <div class="execution-card action-execution-card">
      <h2 id="execution-title" class="action-execution-title" tabindex="-1">
        {{ actionName }}
      </h2>
      <slot />
    </div>
  </section>
</template>
