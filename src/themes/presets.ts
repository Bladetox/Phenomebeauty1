import { Theme } from './types';

export const THEMES: Record<string, Theme> = {

  // ── Studio Professional ──────────────────────────────────────────────────
  // Light clean admin-grade. Same opacity hierarchy as admin.html on light bg.
  studio: {
    id: 'studio',
    name: 'Studio Professional',
    category: 'light',
    industry: 'general',
    colors: {
      primary: '#0a0a0a',
      secondary: '#404040',
      accent: '#2563eb',
      background: '#fafafa',
      surface: 'rgba(0,0,0,0.035)',
      surfaceHover: 'rgba(0,0,0,0.055)',
      text: {
        primary: 'rgba(10,10,10,0.95)',
        secondary: 'rgba(10,10,10,0.58)',
        tertiary: 'rgba(10,10,10,0.38)'
      },
      border: {
        light: 'rgba(0,0,0,0.06)',
        medium: 'rgba(0,0,0,0.10)',
        heavy: 'rgba(0,0,0,0.20)'
      }
    },
    fonts: {
      heading: "'Inter', -apple-system, sans-serif",
      body: "'Inter', -apple-system, sans-serif"
    },
    radii: { sm: '11px', md: '16px', lg: '20px', xl: '24px' },
    shadows: {
      sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
      md: '0 4px 6px -1px rgba(0,0,0,0.10)',
      lg: '0 10px 15px -3px rgba(0,0,0,0.10)'
    },
    glass: { enabled: true, blur: '24px', opacity: 0.92, saturation: 1.2, borderOpacity: 0.10 }
  },

  // ── Barber Elite ─────────────────────────────────────────────────────────
  // Deep black + gold. Gold-tinted glass. Same 0.96/0.58/0.40 text ladder.
  barber: {
    id: 'barber',
    name: 'Barber Elite',
    category: 'dark',
    industry: 'barber',
    colors: {
      primary: '#d4af37',
      secondary: '#b8941e',
      accent: '#f4d03f',
      background: '#080806',
      surface: 'rgba(212,175,55,0.06)',
      surfaceHover: 'rgba(212,175,55,0.10)',
      text: {
        primary: 'rgba(255,255,255,0.96)',
        secondary: 'rgba(255,255,255,0.58)',
        tertiary: 'rgba(255,255,255,0.40)'
      },
      border: {
        light: 'rgba(212,175,55,0.06)',
        medium: 'rgba(212,175,55,0.12)',
        heavy: 'rgba(212,175,55,0.22)'
      }
    },
    fonts: {
      heading: "'Cinzel', serif",
      body: "'Roboto', sans-serif"
    },
    radii: { sm: '11px', md: '16px', lg: '20px', xl: '24px' },
    shadows: {
      sm: '0 2px 8px rgba(0,0,0,0.60)',
      md: '0 8px 32px rgba(0,0,0,0.70)',
      lg: '0 20px 60px rgba(0,0,0,0.80)'
    },
    glass: { enabled: true, blur: '24px', opacity: 0.92, saturation: 1.5, borderOpacity: 0.22 }
  },

  // ── Beautician Blush ─────────────────────────────────────────────────────
  // Warm blush light theme. Opacity hierarchy adapted for dark text on light.
  beautician: {
    id: 'beautician',
    name: 'Beautician Blush',
    category: 'light',
    industry: 'beautician',
    colors: {
      primary: '#e8a5a5',
      secondary: '#f4d3d3',
      accent: '#d4af37',
      background: '#fdf8f8',
      surface: 'rgba(255,255,255,0.85)',
      surfaceHover: 'rgba(255,255,255,0.95)',
      text: {
        primary: 'rgba(45,36,36,0.95)',
        secondary: 'rgba(45,36,36,0.58)',
        tertiary: 'rgba(45,36,36,0.38)'
      },
      border: {
        light: 'rgba(232,165,165,0.08)',
        medium: 'rgba(232,165,165,0.18)',
        heavy: 'rgba(232,165,165,0.30)'
      }
    },
    fonts: {
      heading: "'Crimson Text', serif",
      body: "'Raleway', sans-serif"
    },
    radii: { sm: '12px', md: '18px', lg: '24px', xl: '32px' },
    shadows: {
      sm: '0 2px 12px rgba(232,165,165,0.15)',
      md: '0 8px 28px rgba(232,165,165,0.20)',
      lg: '0 16px 48px rgba(232,165,165,0.25)'
    },
    glass: { enabled: true, blur: '24px', opacity: 0.85, saturation: 1.6, borderOpacity: 0.18 }
  },

  // ── Photographer Monochrome ───────────────────────────────────────────────
  // B&W flat precision. No glass. Same opacity text hierarchy on white.
  photographer: {
    id: 'photographer',
    name: 'Photographer Monochrome',
    category: 'neutral',
    industry: 'photographer',
    colors: {
      primary: '#1a1a1a',
      secondary: '#4a4a4a',
      accent: '#dc143c',
      background: '#ffffff',
      surface: 'rgba(0,0,0,0.03)',
      surfaceHover: 'rgba(0,0,0,0.055)',
      text: {
        primary: 'rgba(10,10,10,0.95)',
        secondary: 'rgba(10,10,10,0.58)',
        tertiary: 'rgba(10,10,10,0.38)'
      },
      border: {
        light: 'rgba(0,0,0,0.04)',
        medium: 'rgba(0,0,0,0.10)',
        heavy: 'rgba(0,0,0,0.20)'
      }
    },
    fonts: {
      heading: "'Oswald', sans-serif",
      body: "'Source Sans Pro', sans-serif"
    },
    radii: { sm: '2px', md: '4px', lg: '6px', xl: '8px' },
    shadows: {
      sm: '0 1px 3px rgba(0,0,0,0.12)',
      md: '0 4px 12px rgba(0,0,0,0.15)',
      lg: '0 8px 24px rgba(0,0,0,0.18)'
    },
    glass: { enabled: false, blur: '0px', opacity: 1, saturation: 1, borderOpacity: 0 }
  },

  // ── Tattoo Dark ───────────────────────────────────────────────────────────
  // Deep black + teal. Teal-tinted glass. Same admin.html opacity ladder.
  tattoo: {
    id: 'tattoo',
    name: 'Tattoo Dark',
    category: 'dark',
    industry: 'tattoo',
    colors: {
      primary: '#1a5f5f',
      secondary: '#2a7f7f',
      accent: '#8b3a3a',
      background: '#080808',
      surface: 'rgba(26,95,95,0.08)',
      surfaceHover: 'rgba(26,95,95,0.12)',
      text: {
        primary: 'rgba(240,240,240,0.96)',
        secondary: 'rgba(240,240,240,0.58)',
        tertiary: 'rgba(240,240,240,0.40)'
      },
      border: {
        light: 'rgba(26,95,95,0.08)',
        medium: 'rgba(26,95,95,0.14)',
        heavy: 'rgba(26,95,95,0.24)'
      }
    },
    fonts: {
      heading: "'Bebas Neue', sans-serif",
      body: "'Barlow', sans-serif"
    },
    radii: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
    shadows: {
      sm: '0 2px 10px rgba(0,0,0,0.70)',
      md: '0 8px 32px rgba(0,0,0,0.80)',
      lg: '0 20px 60px rgba(0,0,0,0.85)'
    },
    glass: { enabled: true, blur: '24px', opacity: 0.85, saturation: 1.4, borderOpacity: 0.24 }
  },

  // ── Skincare Sage ─────────────────────────────────────────────────────────
  // Warm sage light theme. Opacity hierarchy adapted for dark-on-light.
  skincare: {
    id: 'skincare',
    name: 'Skincare Sage',
    category: 'light',
    industry: 'skincare',
    colors: {
      primary: '#6b8e7f',
      secondary: '#8fa99e',
      accent: '#c9a86a',
      background: '#f4f2ee',
      surface: 'rgba(255,255,255,0.80)',
      surfaceHover: 'rgba(255,255,255,0.92)',
      text: {
        primary: 'rgba(45,62,54,0.95)',
        secondary: 'rgba(45,62,54,0.58)',
        tertiary: 'rgba(45,62,54,0.38)'
      },
      border: {
        light: 'rgba(107,142,127,0.08)',
        medium: 'rgba(107,142,127,0.16)',
        heavy: 'rgba(107,142,127,0.26)'
      }
    },
    fonts: {
      heading: "'Lora', serif",
      body: "'Work Sans', sans-serif"
    },
    radii: { sm: '10px', md: '16px', lg: '22px', xl: '30px' },
    shadows: {
      sm: '0 2px 12px rgba(107,142,127,0.10)',
      md: '0 8px 28px rgba(107,142,127,0.15)',
      lg: '0 16px 48px rgba(107,142,127,0.20)'
    },
    glass: { enabled: true, blur: '20px', opacity: 0.88, saturation: 1.5, borderOpacity: 0.16 }
  },

  // ── PhenomeBeauty ─────────────────────────────────────────────────────────
  // EXACT design tokens from public/admin.html :root
  // --bg #050508  --card rgba(255,255,255,0.055)  --border rgba(255,255,255,0.10)
  // --border-hi rgba(255,255,255,0.22)
  // --green #4ade80  --amber #fbbf24  --red #f87171
  // --font-d Cormorant Garamond  --font-b Jost
  // text: t100=0.96 · t60=0.58 · t40=0.40
  phenomebeauty: {
    id: 'phenomebeauty',
    name: 'PhenomeBeauty',
    category: 'dark',
    industry: 'beautician',
    colors: {
      primary: '#4ade80',
      secondary: '#fbbf24',
      accent: '#f87171',
      background: '#050508',
      surface: 'rgba(255,255,255,0.055)',
      surfaceHover: 'rgba(255,255,255,0.09)',
      text: {
        primary: 'rgba(255,255,255,0.96)',
        secondary: 'rgba(255,255,255,0.58)',
        tertiary: 'rgba(255,255,255,0.40)'
      },
      border: {
        light: 'rgba(255,255,255,0.06)',
        medium: 'rgba(255,255,255,0.10)',
        heavy: 'rgba(255,255,255,0.22)'
      }
    },
    fonts: {
      heading: "'Cormorant Garamond', Georgia, serif",
      body: "'Jost', system-ui, sans-serif"
    },
    radii: { sm: '11px', md: '16px', lg: '20px', xl: '24px' },
    shadows: {
      sm: '0 4px 12px rgba(0,0,0,0.50)',
      md: '0 20px 60px rgba(0,0,0,0.70)',
      lg: '0 32px 80px rgba(0,0,0,0.70)'
    },
    glass: { enabled: true, blur: '24px', opacity: 0.92, saturation: 1.8, borderOpacity: 0.22 }
  }

};

// Helper to get theme by industry
export function getThemeByIndustry(industry: string): Theme {
  return THEMES[industry] || THEMES.phenomebeauty;
}

// Helper to list all themes
export function getAllThemes(): Theme[] {
  return Object.values(THEMES);
}
