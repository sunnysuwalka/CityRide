/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: /* Deep Green */ "#0B6E4F",   // buttons, links, timeline, active pills
          dark: /* Forest Green */ "#085640",    // hover/pressed (derived, not in the design)
          light: /* Mint Mist */ "#E3F1EB",      // tint (derived, not in the design)
        },
        accent: {                                // "Scheduled" chips
          DEFAULT: /* Steel Blue */ "#1A4A78",
          light: /* Ice Blue */ "#E1ECF8",
        },
        fare: {                                  // "Indicative demo fare" chips
          DEFAULT: /* Deep Violet */ "#4A3A8A",
          light: /* Lavender Mist */ "#EDE9F7",
        },
        surface: {
          DEFAULT: /* Chalk Off-White */ "#F6F7F4", // page background
          light: /* White */ "#FFFFFF",              // cards, inputs
          white: /* White */ "#FFFFFF",
          muted: /* Pale Sage */ "#E6ECE7",          // map ground
          road: /* Light Sage */ "#CFDBD3",          // map roads
          skeleton: /* Soft Sage Gray */ "#E3E9E5",
        },
        neutral: {
          DEFAULT: /* Slate Green-Gray */ "#46564E", // secondary text
          dark: /* Near-Black Green */ "#14201B",    // main text / ink
          light: /* Gray Green */ "#5B6B63",         // placeholders
          border: /* Light Gray-Green */ "#DDE3DF",
          input: /* Sage Gray */ "#8FA096",          // input borders
        },
        alert: {
          error: /* Brick Red */ "#9A2A1A",
          errorLight: /* Blush Pink */ "#FDE7E3",
          notice: /* Dark Amber Brown */ "#5A3F00",       // demo banner text
          noticeLight: /* Cream Yellow */ "#FFF1CC",       // demo banner background
        },
        // success and navy are not used in the V1 design.
        success: {
          DEFAULT: /* Emerald Green */ "#16A34A",
          light: /* Pale Mint */ "#DCFCE7",
          muted: /* Aqua Mint */ "#B9F2E5",
        },
        navy: {
          DEFAULT: /* Midnight Navy */ "#061747",
          light: /* Dark Navy Blue */ "#102B60",
        },
      },

      fontFamily: {
        sora: ["Sora", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        notosans: ["Noto Sans Devanagari", "serif"],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        chip: ["0.6875rem", { lineHeight: "1rem" }],
        display: ["2.75rem", { lineHeight: "1.1" }],
        "display-sm": ["1.875rem", { lineHeight: "1.15" }],
        time: ["1.375rem", { lineHeight: "1.2" }],
      },

      borderRadius: {
        card: "14px",
        button: "10px",
        input: "10px",
        badge: "8px",
        sheet: "20px",
        pill: "9999px",
      },

      spacing: { 18: "4.5rem", 22: "5.5rem" },
      transitionDuration: { 250: "250ms" },
    },
  },
  plugins: [],
};

export default config;