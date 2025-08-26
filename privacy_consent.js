// public/privacy_consent.js
(function () {
  "use strict";

  const KEY = "consent_v1";

  // --- helpers ---
  function baseURL() {
    try {
      if (typeof _baseURL === "function") return _baseURL();
      if (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) return CONFIG.BASE_API_URL;
    } catch (e) {}
    return "";
  }
  function getLang() {
    try {
      if (typeof getCurrentLang === "function") return getCurrentLang();
      if (typeof CONFIG !== "undefined" && CONFIG.LANG_DEFAULT) return CONFIG.LANG_DEFAULT;
    } catch (e) {}
    const html = (document.documentElement.lang || "de").toLowerCase();
    return html.startsWith("en") ? "en" : "de";
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }
  async function track(event, extra) {
    try {
      if (window.api && typeof window.api.track === "function") {
        return window.api.track(Object.assign({ event }, (extra || {})));
      }
      const url = baseURL();
      if (!url) return;
      await fetch(url + "/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ event }, (extra || {}))),
      }).catch(() => {});
    } catch (_) {}
  }

  // --- i18n (fallback jika I18N_PRIVACY tidak ada) ---
  const I18N = (function () {
    const F = {
      banner: {
        de: "Wir verwenden Cookies, um Ihr Erlebnis zu verbessern. Sie können Ihre Einstellungen anpassen.",
        en: "We use cookies to improve your experience. You can customize your settings.",
      },
      buttons: {
        de: { accept: "Akzeptieren", reject: "Ablehnen", settings: "Einstellungen", save: "Speichern" },
        en: { accept: "Accept", reject: "Reject", settings: "Settings", save: "Save" },
      },
      settingsTitle: { de: "Datenschutz-Einstellungen", en: "Privacy Settings" },
      settingsIntro: {
        de: "Wählen Sie, welche Kategorien Sie erlauben möchten.",
        en: "Choose which categories you want to allow.",
      },
      categories: {
        de: { analytics: "Analytics", marketing: "Marketing", personalization: "Personalisierung" },
        en: { analytics: "Analytics", marketing: "Marketing", personalization: "Personalization" },
      },
    };
    if (window.I18N_PRIVACY) {
      // gabungkan agar tetap ada fallback
      const W = window.I18N_PRIVACY;
      return {
        banner: Object.assign({}, F.banner, W.banner || {}),
        buttons: {
          de: Object.assign({}, F.buttons.de, (W.buttons && W.buttons.de) || {}),
          en: Object.assign({}, F.buttons.en, (W.buttons && W.buttons.en) || {}),
        },
        settingsTitle: Object.assign({}, F.settingsTitle, W.settingsTitle || {}),
        settingsIntro: Object.assign({}, F.settingsIntro, W.settingsIntro || {}),
        categories: {
          de: Object.assign({}, F.categories.de, (W.categories && W.categories.de) || {}),
          en: Object.assign({}, F.categories.en, (W.categories && W.categories.en) || {}),
        },
      };
    }
    return F;
  })();

  // --- UI builders ---
  function buildBanner(lang) {
    if (document.getElementById("consent-banner")) return null;
    const wrap = document.createElement("div");
    wrap.id = "consent-banner";
    Object.assign(wrap.style, {
      position: "fixed", bottom: "0", left: "0", right: "0",
      background: "#111", color: "#fff", padding: "12px 16px",
      zIndex: "99999", boxShadow: "0 -2px 12px rgba(0,0,0,0.3)"
    });
    wrap.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; justify-content:space-between; max-width:980px; margin:0 auto;">
        <div style="font-size:14px; line-height:1.4;">${I18N.banner[lang]}</div>
        <div style="white-space:nowrap; display:flex; gap:8px;">
          <button id="consent-reject" style="padding:8px 12px; background:#333; color:#fff; border:1px solid #444;">
            ${I18N.buttons[lang].reject}
          </button>
          <button id="consent-settings" style="padding:8px 12px; background:#333; color:#fff; border:1px solid #444;">
            ${I18N.buttons[lang].settings}
          </button>
          <button id="consent-accept" style="padding:8px 12px; background:#fff; color:#111; border:1px solid #fff; font-weight:600;">
            ${I18N.buttons[lang].accept}
          </button>
        </div>
      </div>`;
    return wrap;
  }

  function buildSettings(lang, pre) {
    if (document.getElementById("consent-settings-modal")) return null;
    const modal = document.createElement("div");
    modal.id = "consent-settings-modal";
    Object.assign(modal.style, { position: "fixed", inset: "0", background: "rgba(0,0,0,0.5)", zIndex: "100000" });
    modal.innerHTML = `
      <div style="background:#fff; color:#111; max-width:560px; margin:8% auto; padding:18px 20px; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.2);">
        <div style="font-size:18px; font-weight:700; margin-bottom:6px;">${I18N.settingsTitle[lang]}</div>
        <div style="font-size:14px; margin-bottom:12px;">${I18N.settingsIntro[lang]}</div>

        <label style="display:block; margin:8px 0; opacity:.7;">
          <input type="checkbox" checked disabled /> Essential — always on
        </label>

        <label style="display:block; margin:8px 0;">
          <input id="consent-analytics" type="checkbox" ${pre.analytics ? "checked" : ""}/> ${I18N.categories[lang].analytics}
        </label>

        <label style="display:block; margin:8px 0;">
          <input id="consent-marketing" type="checkbox" ${pre.marketing ? "checked" : ""}/> ${I18N.categories[lang].marketing}
        </label>

        <label style="display:block; margin:8px 0;">
          <input id="consent-personalization" type="checkbox" ${pre.personalization ? "checked" : ""}/> ${I18N.categories[lang].personalization}
        </label>

        <div style="margin-top:12px; text-align:right;">
          <button id="consent-save" style="padding:8px 12px;">${I18N.buttons[lang].save}</button>
        </div>
      </div>`;
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    return modal;
  }

  // --- core apply ---
  function applyConsent(state, origin) {
    window.CONSENT = state;
    save(state);
    track("consent_given", { consent: state, origin: origin || "unknown" }).catch(() => {});

    // Aktifkan GA jika diizinkan
    if (state.analytics && typeof enableGTM === "function") {
      try { enableGTM(); } catch (_) {}
    }
  }

  // --- init ---
  function init() {
    const existing = load();
    const lang = getLang();

    if (existing) {
      window.CONSENT = existing;
      // kalau ada analytics=true tapi GA belum aktif, hidupkan
      if (existing.analytics && typeof enableGTM === "function") {
        try { enableGTM(); } catch (_) {}
      }
      return; // sudah punya consent → tidak tampilkan banner
    }

    const banner = buildBanner(lang);
    if (!banner) return;
    document.body.appendChild(banner);

    const acceptBtn  = document.getElementById("consent-accept");
    const rejectBtn  = document.getElementById("consent-reject");
    const settingsBtn= document.getElementById("consent-settings");

    acceptBtn.onclick = () => {
      const s = { essential: true, analytics: true, marketing: true, personalization: true, ts: Date.now() };
      applyConsent(s, "banner_accept");
      banner.remove();
    };
    rejectBtn.onclick = () => {
      const s = { essential: true, analytics: false, marketing: false, personalization: false, ts: Date.now() };
      applyConsent(s, "banner_reject");
      banner.remove();
    };
    settingsBtn.onclick = () => {
      const pre = { essential: true, analytics: false, marketing: false, personalization: false };
      const modal = buildSettings(lang, pre) || document.getElementById("consent-settings-modal");
      document.body.appendChild(modal);
      document.getElementById("consent-save").onclick = () => {
        const s = {
          essential: true,
          analytics: !!document.getElementById("consent-analytics").checked,
          marketing: !!document.getElementById("consent-marketing").checked,
          personalization: !!document.getElementById("consent-personalization").checked,
          ts: Date.now()
        };
        applyConsent(s, "settings_save");
        modal.remove(); banner.remove();
      };
    };
  }

  // --- expose manage function ---
  window.openConsentSettings = function () {
    const lang = getLang();
    const s = load() || { essential: true, analytics: false, marketing: false, personalization: false };
    const modal = buildSettings(lang, s) || document.getElementById("consent-settings-modal");
    document.body.appendChild(modal);
    document.getElementById("consent-save").onclick = () => {
      const n = {
        essential: true,
        analytics: !!document.getElementById("consent-analytics").checked,
        marketing: !!document.getElementById("consent-marketing").checked,
        personalization: !!document.getElementById("consent-personalization").checked,
        ts: Date.now()
      };
      applyConsent(n, "settings_manage");
      modal.remove();
    };
  };

  document.addEventListener("DOMContentLoaded", init);
})();
