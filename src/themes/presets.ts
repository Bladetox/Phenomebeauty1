import { Theme } from './types';

export const THEMES: Record<string, Theme> = {
  // Professional B&W Admin Style (No glass - clean flat design)
  studio: {
    id: 'studio',
    name: 'Studio Professional',
    category: 'light',
    industry: 'general',
    colors: {
      primary: '#0a0a0a',
      secondary: '#404040',
      accent: '#2563eb',
      background: '#ffffff',
      surface: '#fafafa',
      surfaceHover: '#f5f5f5',
      text: {
        primary: '#0a0a0a',
        secondary: '#525252',
        tertiary: '#a3a3a3'
      },
      border: {
        light: '#f5f5f5',
        medium: '#e5e5e5',
        heavy: '#d4d4d4'
      }
    },
    fonts: {
      heading: "'Inter', -apple-system, sans-serif",
      body: "'Inter', -apple-system, sans-serif"
    },
    radii: {
      sm: '6px',
      md: '8px',
      lg: '12px',
      xl: '16px'
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
      md: '0 4px 6px -1px rgba(0,0,0,0.1)',
      lg: '0 10px 15px -3px rgba(0,0,0,0.1)'
    },
    glass: {
      enabled: false,
      blur: '0px',
      opacity: 1,
      saturation: 1,
      borderOpacity: 0
    }
  },

  barber: {
    id: 'barber',
    name: 'Barber Elite',
    category: 'dark',
    industry: 'barber',
    colors: {
      primary: '#d4af37',
      secondary: '#b8941e',
      accent: '#f4d03f',
      background: '#0a0a0a',
      surface: '#1a1a1a',
      surfaceHover: '#2a2a2a',
      text: {
        primary: '#ffffff',
        secondary: 'rgba(255,255,255,0.75)',
        tertiary: 'rgba(255,255,255,0.50)'
      },
      border: {
        light: 'rgba(212,175,55,0.15)',
        medium: 'rgba(212,175,55,0.30)',
        heavy: 'rgba(212,175,55,0.50)'
      }
    },
    fonts: {
      heading: "'Cinzel', serif",
      body: "'Roboto', sans-serif"
    },
    radii: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px'
    },
    shadows: {
      sm: '0 2px 8px rgba(0,0,0,0.6)',
      md: '0 8px 24px rgba(0,0,0,0.7)',
      lg: '0 16px 48px rgba(0,0,0,0.8)'
    },
    glass: {
      enabled: true,
      blur: '16px',
      opacity: 0.7,
      saturation: 1.4,
      borderOpacity: 0.2
    }
  },

  beautician: {
    id: 'beautician',
    name: 'Beautician Blush',
    category: 'light',
    industry: 'beautician',
    colors: {
      primary: '#e8a5a5',
      secondary: '#f4d3d3',
      accent: '#d4af37',
      background: '#fff9f9',
      surface: '#ffffff',
      surfaceHover: '#fff5f5',
      text: {
        primary: '#2d2424',
        secondary: '#6b5757',
        tertiary: '#9d8787'
      },
      border: {
        light: '#f4e4e4',
        medium: '#e8d4d4',
        heavy: '#d4b4b4'
      }
    },
    fonts: {
      heading: "'Crimson Text', serif",
      body: "'Raleway', sans-serif"
    },
    radii: {
      sm: '12px',
      md: '18px',
      lg: '24px',
      xl: '32px'
    },
    shadows: {
      sm: '0 2px 12px rgba(232,165,165,0.15)',
      md: '0 8px 28px rgba(232,165,165,0.20)',
      lg: '0 16px 48px rgba(232,165,165,0.25)'
    },
    glass: {
      enabled: true,
      blur: '24px',
      opacity: 0.85,
      saturation: 1.6,
      borderOpacity: 0.15
    }
  },

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
      surface: '#f5f5f5',
      surfaceHover: '#ebebeb',
      text: {
        primary: '#0a0a0a',
        secondary: '#4a4a4a',
        tertiary: '#8a8a8a'
      },
      border: {
        light: '#e5e5e5',
        medium: '#d0d0d0',
        heavy: '#a0a0a0'
      }
    },
    fonts: {
      heading: "'Oswald', sans-serif",
      body: "'Source Sans Pro', sans-serif"
    },
    radii: {
      sm: '2px',
      md: '4px',
      lg: '6px',
      xl: '8px'
    },
    shadows: {
      sm: '0 1px 3px rgba(0,0,0,0.12)',
      md: '0 4px 12px rgba(0,0,0,0.15)',
      lg: '0 8px 24px rgba(0,0,0,0.18)'
    },
    glass: {
      enabled: false,
      blur: '0px',
      opacity: 1,
      saturation: 1,
      borderOpacity: 0
    }
  },

  tattoo: {
    id: 'tattoo',
    name: 'Tattoo Dark',
    category: 'dark',
    industry: 'tattoo',
    colors: {
      primary: '#1a5f5f',
      secondary: '#2a7f7f',
      accent: '#8b3a3a',
      background: '#0d0d0d',
      surface: '#1a1a1a',
      surfaceHover: '#262626',
      text: {
        primary: '#f0f0f0',
        secondary: 'rgba(240,240,240,0.70)',
        tertiary: 'rgba(240,240,240,0.45)'
      },
      border: {
        light: 'rgba(26,95,95,0.20)',
        medium: 'rgba(26,95,95,0.40)',
        heavy: 'rgba(26,95,95,0.60)'
      }
    },
    fonts: {
      heading: "'Bebas Neue', sans-serif",
      body: "'Barlow', sans-serif"
    },
    radii: {
      sm: '6px',
      md: '10px',
      lg: '14px',
      xl: '20px'
    },
    shadows: {
      sm: '0 2px 10px rgba(0,0,0,0.7)',
      md: '0 8px 28px rgba(0,0,0,0.8)',
      lg: '0 16px 48px rgba(0,0,0,0.85)'
    },
    glass: {
      enabled: true,
      blur: '18px',
      opacity: 0.75,
      saturation: 1.3,
      borderOpacity: 0.25
    }
  },

  skincare: {
    id: 'skincare',
    name: 'Skincare Sage',
    category: 'light',
    industry: 'skincare',
    colors: {
      primary: '#6b8e7f',
      secondary: '#8fa99e',
      accent: '#c9a86a',
      background: '#f5f3ef',
      surface: '#ffffff',
      surfaceHover: '#fafaf8',
      text: {
        primary: '#2d3e36',
        secondary: '#5a6c62',
        tertiary: '#8b9a91'
      },
      border: {
        light: '#e8e6e1',
        medium: '#d4d0c9',
        heavy: '#bfb9ae'
      }
    },
    fonts: {
      heading: "'Lora', serif",
      body: "'Work Sans', sans-serif"
    },
    radii: {
      sm: '10px',
      md: '16px',
      lg: '22px',
      xl: '30px'
    },
    shadows: {
      sm: '0 2px 12px rgba(107,142,127,0.10)',
      md: '0 8px 28px rgba(107,142,127,0.15)',
      lg: '0 16px 48px rgba(107,142,127,0.20)'
    },
    glass: {
      enabled: true,
      blur: '20px',
      opacity: 0.9,
      saturation: 1.5,
      borderOpacity: 0.12
    }
  },

  // PhenomeBeauty Glassmorphic (from admin.html)
  phenomebeauty: {
    id: 'phenomebeauty',
    name: 'PhenomeBeauty Glass',
    category: 'dark',
    industry: 'beautician',
    colors: {
      primary: '#4ade80',       // Green accent
      secondary: '#fbbf24',     // Amber
      accent: '#f87171',        // Red
      background: '#050508',    // Deep black
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
      heading: "'Cormorant Garamond', serif",
      body: "'Jost', sans-serif"
    },
    radii: {
      sm: '11px',
      md: '16px',
      lg: '20px',
      xl: '24px'
    },
    shadows: {
      sm: '0 4px 12px rgba(0,0,0,0.50)',
      md: '0 20px 60px rgba(0,0,0,0.70)',
      lg: '0 32px 80px rgba(0,0,0,0.70)'
    },
    glass: {
      enabled: true,
      blur: '24px',
      opacity: 0.92,
      saturation: 1.8,
      borderOpacity: 0.18
    }
  }
};

// Helper to get theme by industry
export function getThemeByIndustry(industry: string): Theme {
  return THEMES[industry] || THEMES.studio;
}

// Helper to list all themes
export function getAllThemes(): Theme[] {
  return Object.values(THEMES);
}
