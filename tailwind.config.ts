import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Redesign token map (ТЗ §1.1). The legacy scale names are kept so the
        // whole app inherits the new palette without a mass rename:
        //   grass-600 = Primary #1C7A46 · grass-500 = Emerald #28A35A ·
        //   grass-900 = Primary-dark #12331F · ball-500 = Lime #C3E84F ·
        //   ink-900 = Text #16321F · ink-500 = Muted #6A8172 ·
        //   ink-400 = Hint #8AA093 · clay-500 = Danger #CC5A4F.
        grass: {
          50: "#E4F2DF",
          100: "#D3ECC4",
          200: "#B4DFA6",
          300: "#83CB84",
          400: "#3FAF66",
          500: "#28A35A",
          600: "#1C7A46",
          700: "#1C6B40",
          800: "#17512F",
          900: "#12331F",
          lume: "#2A9556",
          deep: "#12331F",
        },
        ball: {
          50: "#F4FADF",
          100: "#EEF7CF",
          200: "#E3F3AC",
          300: "#DBF18C",
          400: "#CFEC6B",
          500: "#C3E84F",
          600: "#A7DD3C",
          700: "#5C7A12",
          800: "#46610C",
          900: "#2F4507",
        },
        clay: {
          50: "#FBEEEC",
          100: "#FBE4E1",
          200: "#F3C4BE",
          300: "#E79A90",
          400: "#D97267",
          500: "#CC5A4F",
          600: "#B04A40",
          700: "#8F3B33",
          800: "#6D2C26",
          900: "#471D19",
          dust: "#CC5A4F",
          deep: "#8F3B33",
        },
        // Warning ("Скоро старт", "По заявке"): #B7811F on #FDF1D8.
        sun: {
          50: "#FDF1D8",
          100: "#FBE7B9",
          600: "#B7811F",
          700: "#946617",
        },
        ink: {
          50: "#EEF1EA",
          100: "#E2E8DF",
          200: "#D3DCD2",
          300: "#B4C2B6",
          400: "#8AA093",
          500: "#6A8172",
          600: "#4E6355",
          700: "#35493C",
          800: "#22382A",
          900: "#16321F",
        },
        atp: {
          deep: "#002B5B",
          night: "#001530",
          mid: "#0E5BD8",
        },
        hard: {
          acid: "#FF4D00",
          cobalt: "#0E5BD8",
        },
        lime: {
          neon: "#D4FF3A",
        },
        silver: {
          DEFAULT: "#C8CDD3",
          dim: "#8B95A0",
        },
        carpet: {
          50: "#F4EFE5",
          500: "#A07C4E",
          900: "#3E2E18",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        // Space Grotesk (numeric accent) has no cyrillic — Manrope catches
        // russian glyphs so mixed labels stay consistent.
        mono: ["var(--font-mono)", "var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        // ТЗ §1.3: cards 20px, large sections 24px, hero 28px.
        xl2: "20px",
        xl3: "24px",
        hero: "28px",
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        // ТЗ §1.4.
        card: "0 1px 2px rgba(20,60,30,0.04), 0 12px 30px rgba(20,60,30,0.05)",
        cardHover: "0 18px 42px rgba(20,60,30,0.12)",
        glow: "0 8px 20px rgba(28,122,70,0.3)",
        ace: "0 0 0 4px #C3E84F, 0 8px 24px -8px #1C7A46",
        ember:
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px -20px rgba(255,77,0,0.45)",
        glassDark:
          "inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 60px -30px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        // ТЗ §1.1 gradients.
        "pt-primary": "linear-gradient(135deg,#1C7A46,#28A35A)",
        "pt-hero": "linear-gradient(135deg,#12331F,#1C6B40,#2A9556)",
        "pt-lime": "linear-gradient(135deg,#C9E85B,#A9DD3F)",
        "pt-icon": "linear-gradient(135deg,#E7F4D9,#D3ECC4)",
        "night-aura":
          "radial-gradient(60% 60% at 30% 30%, rgba(14,91,216,0.35) 0%, transparent 60%), radial-gradient(70% 70% at 80% 75%, rgba(0,43,91,0.55) 0%, transparent 65%), #001530",
      },
      keyframes: {
        // ТЗ §1.6.
        ptFade: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ptPulse: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.55)", opacity: "0.35" },
        },
        bounceBall: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        letCordShake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.55" },
          "50%": { transform: "scale(1.06)", opacity: "0.8" },
        },
      },
      animation: {
        ptFade: "ptFade 0.4s ease both",
        ptPulse: "ptPulse 1.8s ease-in-out infinite",
        bounceBall: "bounceBall 1.4s ease-in-out infinite",
        letCordShake: "letCordShake 0.4s ease-in-out",
        rise: "rise 700ms cubic-bezier(0.22,1,0.36,1) both",
        breathe: "breathe 7s ease-in-out infinite",
      },
      transitionTimingFunction: {
        followThrough: "cubic-bezier(0.22, 1, 0.36, 1)",
        impact: "cubic-bezier(0.83, 0, 0.17, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
