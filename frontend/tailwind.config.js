/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#f0f9ff",
                    100: "#e0f2fe",
                    200: "#bae6fd",
                    300: "#7dd3fc",
                    400: "#38bdf8",
                    500: "#0ea5e9",
                    600: "#0284c7",
                    700: "#0369a1",
                    800: "#075985",
                    900: "#0c4a6e",
                },
                ink: {
                    50: "#f8fafc",
                    100: "#f1f5f9",
                    200: "#e2e8f0",
                    300: "#cbd5e1",
                    400: "#94a3b8",
                    500: "#64748b",
                    600: "#475569",
                    700: "#334155",
                    800: "#1e293b",
                    900: "#0f172a",
                    950: "#020617",
                },
            },
            fontFamily: {
                sans: ["DM Sans", "system-ui", "sans-serif"],
                display: ["Outfit", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },
            boxShadow: {
                card: "0 4px 24px -4px rgb(15 23 42 / 0.08)",
                "card-lg": "0 8px 40px -8px rgb(15 23 42 / 0.15)",
                glow: "0 0 24px rgba(14, 165, 233, 0.25)",
                "glow-sm": "0 0 12px rgba(14, 165, 233, 0.2)",
                "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.1)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
                "mesh-gradient": "radial-gradient(at 40% 20%, hsla(210,100%,56%,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.04) 0px, transparent 50%)",
            },
            animation: {
                "fade-in": "fadeIn 0.4s ease-out",
                "slide-up": "slideUp 0.4s ease-out",
                "slide-in-right": "slideInRight 0.3s ease-out",
                "scale-in": "scaleIn 0.2s ease-out",
                "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                "spin-slow": "spin 3s linear infinite",
                "bounce-subtle": "bounceSubtle 2s ease-in-out infinite",
                shimmer: "shimmer 2s linear infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": {
                        opacity: "0"
                    },
                    "100%": {
                        opacity: "1"
                    },
                },
                slideUp: {
                    "0%": {
                        opacity: "0",
                        transform: "translateY(12px)"
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateY(0)"
                    },
                },
                slideInRight: {
                    "0%": {
                        opacity: "0",
                        transform: "translateX(12px)"
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateX(0)"
                    },
                },
                scaleIn: {
                    "0%": {
                        opacity: "0",
                        transform: "scale(0.95)"
                    },
                    "100%": {
                        opacity: "1",
                        transform: "scale(1)"
                    },
                },
                bounceSubtle: {
                    "0%, 100%": {
                        transform: "translateY(0)"
                    },
                    "50%": {
                        transform: "translateY(-4px)"
                    },
                },
                shimmer: {
                    "0%": {
                        backgroundPosition: "-200% 0"
                    },
                    "100%": {
                        backgroundPosition: "200% 0"
                    },
                },
            },
            transitionTimingFunction: {
                spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            },
        },
    },
    plugins: [],
};