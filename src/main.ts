import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./metronome.css";

createApp(App).use(createPinia()).mount("#app");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error: unknown) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
