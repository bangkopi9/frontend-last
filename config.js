// public/config.js
(function () {
  // --- Base URL priority:
  // 1) query ?api=https://... (untuk quick test)
  // 2) localStorage.apiBase (manual override)
  // 3) hardcoded PROD (Railway)
  // 4) http://localhost:8000 kalau lagi di localhost
  const PROD_API = "https://web-production-352d9.up.railway.app";

  const urlParamApi = new URLSearchParams(location.search).get("api");
  const lsApi = (() => {
    try { return localStorage.getItem("apiBase") || ""; } catch (_) { return ""; }
  })();

  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  const autoLocal = isLocal ? "http://localhost:8000" : "";

  const BASE_API_URL = urlParamApi || lsApi || (isLocal ? autoLocal : PROD_API);

  // Bahasa default: dari <html lang> → navigator.language → "de"
  const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
  const guessLang = htmlLang || (navigator.language || "de").toLowerCase().slice(0, 2);
  const LANG_DEFAULT = (guessLang === "en" ? "en" : "de");

  // Export ke global
  window.CONFIG = {
    BASE_API_URL,
    LANG_DEFAULT,
    GTM_ID: "G-YL8ECJ5V17",

    // Streaming jawaban (gunakan /chat/sse jika true)
    STREAMING: true,
    STREAM_TRANSPORT: "sse", // "sse" | "chunk"

    // CTA untuk tombol “Jetzt buchen / Contact us”
    CTA_URL: "https://planville.de/kontakt",

    // Feature flags funnel → lead form
    FEATURES: {
      AUTO_OPEN_LEAD_FORM: true,     // buka form setelah funnel complete
      OPEN_ON_DISQUALIFY: false      // buka form walau user terdiskualifikasi
    }
  };

  // Helper opsional buat ganti cepat dari console:
  // localStorage.setItem('apiBase','http://localhost:8000'); location.reload();
  // localStorage.removeItem('apiBase'); location.reload();
})();
