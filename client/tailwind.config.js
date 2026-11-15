
/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0B2D6B",
          dark: "#071D4B",
          light: "#F59E0B",
        },
        accent: {
          DEFAULT: "#1E6BFF",
          dark: "#1555D9",
          light: "#5B95FF",
        },
        surface: {
          DEFAULT: "#E7F0FF",
          light: "#F4F7FF",
          muted: "#D8E5FC",
          white: "#FFFFFF",
        },
        neutral: {
          DEFAULT: "#6B7280",
          dark: "#374151",
          light: "#9CA3AF",
          border: "#E5EAF3",
        },
        success: {
          DEFAULT: "#16A34A",
          light: "#DCFCE7",
          muted: "#B9F2E5",
        },
        navy: {
          DEFAULT: "#061747",
          light: "#102B60",
        },
        alert:{
          error: "#EF4444",
          notice: "#D97706"
        }
      },

      fontFamily: {
        sora: ["Sora", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        notosans: ["Noto Sans Devanagari", "serif"]
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },

      borderRadius: {
        card: "24px",
        button: "16px",
        pill: "9999px",
      },

      boxShadow: {
        card: "0 4px 20px rgba(11, 45, 107, 0.08)",
        elevated: "0 8px 30px rgba(11, 45, 107, 0.12)",
        button: "0 4px 12px rgba(30, 107, 255, 0.22)",
        soft: "0 2px 10px rgba(15, 35, 80, 0.06)",
      },

      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #061747 0%, #0B2D6B 55%, #1E6BFF 100%)",
        "surface-gradient":
          "linear-gradient(135deg, #F4F7FF 0%, #E7F0FF 100%)",
        "blue-gradient":
          "linear-gradient(90deg, #1E6BFF 0%, #1555D9 100%)",
      },

      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },

      transitionDuration: {
        250: "250ms",
      },
    },
  },
  plugins: [],
};

export default config;
