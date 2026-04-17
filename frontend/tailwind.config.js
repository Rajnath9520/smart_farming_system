/** @type {import('tailwindcss').Config} */
export default{
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas:  "#F0F7F4",
        surface: "#FFFFFF",
        "surface-2": "#F7FBF9",
        "surface-3": "#EEF7F2",

        primary: {
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
          950: "#022C22",
        },

        teal: {
          50:  "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },


        ink: {
          50:  "#F8FAFB",
          100: "#F0F4F2",
          200: "#E2EAE6",
          300: "#C8D8CE",
          400: "#96B3A5",
          500: "#6B8F7E",
          600: "#4A6B5A",
          700: "#2D4A3B",
          800: "#1A3028",
          900: "#0E1F18",
        },
      },
      fontFamily: {
        display: ["'Sora'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        card:   "0 1px 3px rgba(16,185,129,0.06), 0 4px 16px rgba(16,185,129,0.08)",
        "card-hover": "0 4px 20px rgba(16,185,129,0.15), 0 1px 3px rgba(16,185,129,0.1)",
        "card-lg": "0 8px 40px rgba(16,185,129,0.12)",
        btn:    "0 2px 12px rgba(16,185,129,0.35)",
        "btn-lg": "0 4px 24px rgba(16,185,129,0.4)",
        inset:  "inset 0 1px 2px rgba(16,185,129,0.06)",
        glow:   "0 0 30px rgba(16,185,129,0.2)",
        "glow-sm": "0 0 12px rgba(16,185,129,0.15)",
      },
      backgroundImage: {
        "hero-mesh":  "radial-gradient(at 40% 20%, hsla(150,72%,93%,1) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(164,76%,90%,1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(140,60%,94%,1) 0px, transparent 50%)",
        "card-mesh":  "radial-gradient(at 0% 0%, hsla(152,70%,97%,1) 0px, transparent 60%)",
        "green-fade": "linear-gradient(135deg, #ECFDF5, #F0FFF4)",
        "stripe":     "repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(16,185,129,0.03) 8px,rgba(16,185,129,0.03) 16px)",
      },
      animation: {
        "fade-in":   "fadeIn 0.4s ease-out",
        "slide-up":  "slideUp 0.4s ease-out",
        "slide-in":  "slideIn 0.35s ease-out",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        shimmer:     "shimmer 2s linear infinite",
        "motor-ring":"spin 3s linear infinite",
        "float":     "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:  { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideIn:  { from: { opacity: "0", transform: "translateX(-16px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        pulseDot: { "0%,100%": { transform: "scale(1)", opacity: "1" }, "50%": { transform: "scale(2.5)", opacity: "0" } },
        shimmer:  { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float:    { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};