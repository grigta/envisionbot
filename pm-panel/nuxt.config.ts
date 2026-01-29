export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ["@nuxt/ui"],

  css: ["~/assets/css/main.css"],

  colorMode: {
    preference: "system", // Use system preference by default
    fallback: "dark", // Fallback to dark if system preference is unavailable
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3001",
    },
  },

  app: {
    head: {
      title: "Envision CEO",
      meta: [
        { name: "description", content: "Envision CEO Control Panel" },
      ],
    },
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
  },

  compatibilityDate: "2024-01-28",
});
