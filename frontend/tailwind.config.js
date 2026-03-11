// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.90)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        // 👇 Custom bounce keyframe
        bounce3x: {
          '0%, 100%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
        shake: 'shake 0.8s ease-in-out 2',
        modalEnter: 'fadeIn 0.5s ease-out, shake 0.5s ease-in-out 2',
        // 👇 Bounce 3x
        bounce3x: 'bounce3x 0.6s ease-in-out',
      },
    },
  },
  plugins: [],
};
