// Configuration constants for the portfolio application
export const CONFIG = {
  // Device detection
  DEVICE: {
    IS_MOBILE: navigator.userAgent.match(/Android/i)
      || navigator.userAgent.match(/webOS/i)
      || navigator.userAgent.match(/iPhone/i)
      || navigator.userAgent.match(/iPad/i)
      || navigator.userAgent.match(/iPod/i)
      || navigator.userAgent.match(/BlackBerry/i)
      || navigator.userAgent.match(/Windows Phone/i)
  },

  // Slider settings
  SLIDER: {
    SPEED: {
      DESKTOP: 1.5,
      MOBILE: 1.2
    },
    EASE: {
      DESKTOP: 0.06,
      MOBILE: 0.08
    },
    WRAPPER_SIZE: 150,
    ITEM_SIZE: 45,
    UNIFORM_SPEED: 0.05
  },

  // PIXI settings
  PIXI: {
    BACKGROUND: 0xf1f1f1,
    ANTIALIAS: true,
    RESOLUTION: Math.min(window.devicePixelRatio, 2)
  },

  // Animation durations
  ANIMATION: {
    HOVER_DELAY: 300,
    FADE_DELAY: 100,
    EXPAND_DURATION: 0.8,
    FADE_DURATION: 0.5,
    TRANSITION_DURATION: 1.0
  },

  // Layout sizes
  LAYOUT: {
    ITEM_WIDTH_VW: 18,
    ITEM_WIDTH_MOBILE_VW: 45,
    PROJECT_LIST_TOP: '60px'
  },

  // Selectors
  SELECTORS: {
    SLIDE: '.js-slide',
    SLIDE_INNER: '.js-slide__inner',
    SLIDE_IMG: '.js-slide__img',
    PROJECT_ITEM: '.project-item',
    PROJECT_TITLE: '.project-title',
    PROJECT_DETAILS: '.project-details',
    PROJECT_DESCRIPTION: '.project-description',
    PROJECT_HERO_IMAGE: '.project-hero-image'
  }
};

// Global store
export const store = {
  ww: window.innerWidth,
  wh: window.innerHeight,
  isDevice: CONFIG.DEVICE.IS_MOBILE
};