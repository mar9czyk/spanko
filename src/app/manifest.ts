import type { MetadataRoute } from "next";

export const APP_THEME_COLOR = "#0B0F17";

/**
 * Manifest PWA aplikacji Spanko (instalowalność; bez cache'owania danych API).
 *
 * @returns {MetadataRoute.Manifest} Konfiguracja manifestu
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spanko",
    short_name: "Spanko",
    description: "Asystent snu i rutyny dziecka z deterministycznym silnikiem snu",
    lang: "pl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_THEME_COLOR,
    theme_color: APP_THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
