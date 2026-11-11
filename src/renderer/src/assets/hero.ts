import { heroui } from '@heroui/react'

export default heroui({
  layout: {
    disabledOpacity: 0.5,
    dividerWeight: '1px',
    fontSize: {
      tiny: '0.875rem',
      small: '0.875rem',
      medium: '0.875rem',
      large: '0.875rem'
    },
    radius: {
      small: '4px',
      medium: '6px',
      large: '8px'
    },
    borderWidth: {
      small: '1px',
      medium: '1px',
      large: '1px'
    }
  },
  themes: {
    light: {
      colors: {
        background: '#ffffff',
        foreground: '#09090b',
        divider: '#e4e4e7',
        focus: '#71717a',
        content1: '#fafafa',
        content2: '#f4f4f5',
        content3: '#e4e4e7',
        content4: '#d4d4d8',
        default: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          foreground: '#09090b',
          DEFAULT: '#f4f4f5'
        },
        primary: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#52525b',
          600: '#3f3f46',
          700: '#27272a',
          800: '#18181b',
          900: '#09090b',
          foreground: '#fafafa',
          DEFAULT: '#18181b'
        },
        secondary: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#ffffff'
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#09090b'
        },
        danger: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff'
        }
      }
    },
    dark: {
      colors: {
        background: '#09090b',
        foreground: '#fafafa',
        divider: '#27272a',
        focus: '#71717a',
        content1: '#111113',
        content2: '#18181b',
        content3: '#27272a',
        content4: '#3f3f46',
        default: {
          50: '#18181b',
          100: '#27272a',
          200: '#3f3f46',
          300: '#52525b',
          400: '#71717a',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#e4e4e7',
          800: '#f4f4f5',
          900: '#fafafa',
          foreground: '#fafafa',
          DEFAULT: '#27272a'
        },
        primary: {
          50: '#18181b',
          100: '#27272a',
          200: '#3f3f46',
          300: '#52525b',
          400: '#71717a',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#e4e4e7',
          800: '#f4f4f5',
          900: '#fafafa',
          foreground: '#09090b',
          DEFAULT: '#e4e4e7'
        },
        secondary: {
          DEFAULT: '#10b981',
          foreground: '#09090b'
        },
        success: {
          DEFAULT: '#10b981',
          foreground: '#09090b'
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#09090b'
        },
        danger: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff'
        }
      }
    }
  }
})
