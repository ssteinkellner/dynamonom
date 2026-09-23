<script setup lang="ts">
import type { StopwatchAction } from "../../action-model.ts";

defineProps<{ action: StopwatchAction }>();
</script>

<template>
  <div class="action-type-fields">
    <fieldset>
      <legend>Zeitmessung</legend>
      <p class="field-help">
        Die Stoppuhr misst die verstrichene Zeit für Formelbezüge in späteren
        Aktionen.
      </p>
    </fieldset>
  </div>
</template>
