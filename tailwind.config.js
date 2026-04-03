/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════════════
        // shadcn/ui CSS Variables
        // ═══════════════════════════════════════════════════════════
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },

        // ═══════════════════════════════════════════════════════════
        // Legacy cmpDesk Design Tokens (mapped to shadcn variables)
        // ═══════════════════════════════════════════════════════════
        
        // Backgrounds (legacy aliases)
        'app': 'hsl(var(--background))',
        'surface': 'hsl(var(--card))',
        'surface-light': 'hsl(var(--accent))',

        // Text colors (legacy aliases - prefixed with 'text-' in usage)
        'text-primary': 'hsl(var(--foreground))',
        'text-secondary': 'hsl(var(--muted-foreground))',
        'text-muted': 'hsl(var(--muted-foreground) / 0.7)',

        // Accent (legacy aliases)
        'primary-hover': 'hsl(var(--primary) / 0.8)',
        'primary-soft': 'hsl(var(--accent))',

        // Status colors (legacy aliases)
        'success': 'hsl(var(--chart-2))',
        'warning': 'hsl(var(--chart-3))',
        'danger': 'hsl(var(--destructive))',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Manrope Variable', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
