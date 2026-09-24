<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import type { SessionReport } from "../../models/session.ts";
import {
  buildLongReportText,
  buildShortReportText,
  getActionReportSections,
} from "../../models/report-text.ts";
import { copyText } from "../../services/clipboard.ts";

const props = defineProps<{ report: SessionReport }>();
const emit = defineEmits<{
  presets: [];
  settings: [];
  repeat: [];
}>();

const longButton = ref<HTMLButtonElement | null>(null);
const shortButton = ref<HTMLButtonElement | null>(null);
const copyStatus = ref("");
const copiedReport = ref<"long" | "short" | null>(null);
let feedbackTimer = 0;

const sections = () => getActionReportSections(props.report);

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
});

async function copyReport(format: "long" | "short"): Promise<void> {
  const button = format === "long" ? longButton.value : shortButton.value;
  const text =
    format === "long"
      ? buildLongReportText(props.report)
      : buildShortReportText(props.report);
  try {
    await copyText(text, button);
    copyStatus.value =
      format === "long"
        ? "Langbericht in die Zwischenablage kopiert."
        : "Kurzbericht in die Zwischenablage kopiert.";
    copiedReport.value = format;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      copiedReport.value = null;
    }, 2000);
  } catch (error) {
    copiedReport.value = null;
    copyStatus.value =
      error instanceof Error
        ? error.message
        : "Der Bericht konnte nicht kopiert werden.";
  }
}
</script>

<template>
  <section class="view">
    <header v-if="report.aborted" class="view-header">
      <p v-if="report.aborted" class="error-status">Aktion abgebrochen</p>
    </header>

    <div class="action-report-sections">
      <article
        v-for="section in sections()"
        :key="section.id"
        class="report-card"
      >
        <h3>{{ section.title }}</h3>
        <dl class="report-details">
          <div v-for="detail in section.details" :key="detail.label">
            <dt>{{ detail.label }}</dt>
            <dd>{{ detail.value }}</dd>
          </div>
        </dl>

        <div v-if="section.showBreaks" class="report-breaks">
          <h4>Pausen gebraucht</h4>
          <p v-if="section.breakRecords.length === 0">
            Keine Pausen gebraucht
          </p>
          <div class="table-wrapper">
            <table v-if="section.breakRecords.length > 0" class="report-table">
              <thead>
                <tr>
                  <th scope="col">Nr.</th>
                  <th scope="col">Beat</th>
                  <th scope="col">BPM</th>
                  <th scope="col">Limit</th>
                  <th scope="col">Beendet</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in section.breakRecords" :key="record.number">
                  <td>{{ record.number }}</td>
                  <td>{{ record.beat }}</td>
                  <td>{{ record.bpm }}</td>
                  <td>{{ record.overLimit ? "Überschritten" : "Eingehalten" }}</td>
                  <td>{{ record.ended }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>

    <p v-if="copyStatus" class="status" role="status" aria-live="polite">
      {{ copyStatus }}
    </p>

    <div class="report-actions">
      <div class="report-action-row report-copy-actions">
        <button
          ref="longButton"
          class="secondary-button"
          type="button"
          @click="copyReport('long')"
        >
          {{ copiedReport === "long" ? "Kopiert!" : "Langbericht kopieren" }}
        </button>
        <button
          ref="shortButton"
          class="primary-button"
          type="button"
          @click="copyReport('short')"
        >
          {{
            copiedReport === "short"
              ? "Kopiert!"
              : "Kurzbericht in Zwischenablage kopieren"
          }}
        </button>
      </div>
      <div class="report-action-row report-navigation-actions">
        <button class="secondary-button" type="button" @click="emit('presets')">
          Zurück zu Voreinstellungen
        </button>
        <button class="secondary-button" type="button" @click="emit('settings')">
          Zurück zu Einstellungen
        </button>
        <button class="primary-button" type="button" @click="emit('repeat')">
          Wiederholen
        </button>
      </div>
    </div>
  </section>
</template>
