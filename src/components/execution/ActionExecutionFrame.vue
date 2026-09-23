<script setup lang="ts">
defineProps<{
  actionName: string;
  actionTypeLabel: string;
  progressLabel: string;
  hideProgress: boolean;
  message: string;
}>();
</script>

<template>
  <section class="view" aria-labelledby="execution-title">
    <header class="view-header">
      <p v-if="!hideProgress && progressLabel" class="eyebrow action-progress">
        {{ progressLabel }}
      </p>
      <p class="eyebrow">{{ actionTypeLabel }}</p>
      <h1 id="execution-title" tabindex="-1">{{ actionName }}</h1>
    </header>
    <p v-if="message" class="status error-status" role="alert" aria-live="polite">
      {{ message }}
    </p>
    <div class="execution-card action-execution-card">
      <slot />
    </div>
  </section>
</template>
