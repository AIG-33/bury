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
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,20,0.04), 0 8px 24px -12px rgba(15,27,20,0.12)",
        ace: "0 0 0 4px #D7F205, 0 8px 24px -8px #1F8A4C",
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
      },
      animation: {
        bounceBall: "bounceBall 1.4s ease-in-out infinite",
        letCordShake: "letCordShake 0.4s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
