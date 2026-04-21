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
        grass: {
          50: "#EAF7EE",
          100: "#D2EFD8",
          200: "#A6E0B5",
          300: "#74CB91",
          400: "#43B26F",
          500: "#1F8A4C",
          600: "#187341",
          700: "#155E36",
          800: "#11472A",
          900: "#0B2E1B",
          lume: "#2E6B5A",
          deep: "#1A3C34",
        },
        ball: {
          50: "#FBFEDD",
          100: "#F8FDB8",
          200: "#F2FBA8",
          300: "#EAF876",
          400: "#E2F644",
          500: "#D7F205",
          600: "#B5CB04",
          700: "#8FA303",
          800: "#6A7902",
          900: "#454F01",
        },
        clay: {
          50: "#FBEEE9",
          100: "#F8DCD0",
          200: "#EFB6A0",
          300: "#E48F70",
          400: "#DA7548",
          500: "#C75B3A",
          600: "#A8482D",
          700: "#883623",
          800: "#69281A",
          900: "#451810",
          dust: "#C66B4F",
          deep: "#9C3A2B",
        },
        ink: {
          50: "#F4F6F5",
          100: "#E6EBE8",
          200: "#D7DDD9",
          300: "#B6BFB9",
          400: "#8C988F",
          500: "#5B6A60",
          600: "#445048",
          700: "#2D352F",
          800: "#1B2620",
          900: "#0F1B14",
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
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,20,0.04), 0 8px 24px -12px rgba(15,27,20,0.12)",
        ace: "0 0 0 4px #D7F205, 0 8px 24px -8px #1F8A4C",
        ember:
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px -20px rgba(255,77,0,0.45)",
        glassDark:
          "inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 60px -30px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "night-aura":
          "radial-gradient(60% 60% at 30% 30%, rgba(14,91,216,0.35) 0%, transparent 60%), radial-gradient(70% 70% at 80% 75%, rgba(0,43,91,0.55) 0%, transparent 65%), #001530",
      },
      keyframes: {
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
