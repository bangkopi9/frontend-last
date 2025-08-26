// 🌍 Global Config for Deployment & Local Testing
const CONFIG = {
  // ✅ Gunakan ini saat testing lokal
  BASE_API_URL: "https://full-ai-backend-production.up.railway.app", // ⬅️ ubah dari "https://your-backend-url.com"
  
  // 🌐 Saat nanti deploy ke Render atau Railway, ganti dengan domain backend kamu
  // BASE_API_URL: "https://full-ai-backend-production.up.railway.app", // contoh jika sudah live

  LANG_DEFAULT: "de", // Default bahasa Jerman
  GTM_ID: "G-YL8ECJ5V17" // Google Tag Manager ID
};,
  STREAMING: true,
  STREAM_TRANSPORT: "chunk"
};
