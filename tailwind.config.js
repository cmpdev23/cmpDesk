/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════════════
        // cmpDesk Design System - NordVPN Inspired Palette
        // ═══════════════════════════════════════════════════════════

        // Backgrounds
        'app': '#0B0F14',           // Background global très dark
        'surface': '#121821',        // Cartes / panels
        'surface-light': '#1A2230', // Hover / variation

        // Borders
        'border': '#1F2A3A',

        // Text colors (prefixed with 'text-' in usage becomes 'text-text-xxx')
        'text-primary': '#E6EDF3',
        'text-secondary': '#9FB0C3',
        'text-muted': '#6B7C93',

        // Accent (bleu NordVPN style)
        'primary': '#3B82F6',        // blue-500 proche
        'primary-hover': '#2563EB',  // blue-600
        'primary-soft': '#1E293B',   // fond léger bleu/gris

        // Status colors
        'success': '#22C55E',
        'warning': '#F59E0B',
        'danger': '#EF4444',
      },
    },
  },
  plugins: [],
}
