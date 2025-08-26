// public/ai_guardrails_v2.js
window.AIGuard = (function () {
  "use strict";

  const CFG = window.CONFIG || {};
  const API = (CFG && CFG.BASE_API_URL) ? CFG.BASE_API_URL : "";
  const CTA = CFG.CTA_URL || "https://planville.de/kontakt";

  const getLang = () =>
    (typeof window.getCurrentLang === "function")
      ? window.getCurrentLang()
      : (CFG.LANG_DEFAULT || "de");

  async function postJSON(path, body, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(to);
    }
  }

  function normalizeArgs(message, langOrOpts, context_ids) {
    let lang = getLang();
    let timeoutMs = 20000;
    let packs = context_ids || [];

    if (typeof langOrOpts === "string") {
      lang = langOrOpts || lang;
    } else if (langOrOpts && typeof langOrOpts === "object") {
      lang = langOrOpts.lang || lang;
      timeoutMs = Number(langOrOpts.timeoutMs || timeoutMs);
      packs = langOrOpts.context_ids || langOrOpts.context_pack_ids || packs;
    }
    return { message, lang, context_pack_ids: packs, timeoutMs };
  }

  function fallback(lang) {
    return (lang === "de")
      ? "Dazu habe ich keine gesicherte Information. Ich kann dich gerne mit unserem Team verbinden: " + CTA
      : "I don't have verified information on that. I can connect you with our team: " + CTA;
  }

  async function answer(message, langOrOpts, context_ids) {
    const { lang, context_pack_ids, timeoutMs } = normalizeArgs(message, langOrOpts, context_ids);

    try {
      const out = await postJSON("/ai/answer", { message, lang, context_pack_ids }, timeoutMs);

      // Normalisasi bentuk output agar selalu konsisten
      const norm = {
        answer: (out && out.answer) ? String(out.answer) : fallback(lang),
        sources: Array.isArray(out?.sources) ? out.sources : [],
        confidence: (typeof out?.confidence === "number") ? out.confidence : 0,
      };

      // Optional tracking ke backend
      try { window.api?.track?.({ event: "ai_answer_ok", len: (message || "").length, conf: norm.confidence }); } catch (_) {}

      return norm;
    } catch (err) {
      // Track error
      try { window.api?.track?.({ event: "ai_answer_err", msg: String(err) }); } catch (_) {}

      return { answer: fallback(lang), sources: [], confidence: 0 };
    }
  }

  return { answer };
})();
