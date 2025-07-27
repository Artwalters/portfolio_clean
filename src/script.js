import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import barba from '@barba/core';
import { PortfolioApp, ProjectHeroEffect } from './PortfolioApp.js';
import { store } from './config.js';

// Global app instance
let portfolioApp = null;
let projectHeroEffect = null;

// Initialize the application
async function initApp() {
  try {
    console.log('Starting portfolio application...');
    
    portfolioApp = new PortfolioApp();
    const success = await portfolioApp.init();
    
    if (!success) {
      throw new Error('Failed to initialize portfolio app');
    }
    
    console.log('Portfolio application started successfully');
    return true;
  } catch (error) {
    console.error('Failed to start portfolio application:', error);
    return false;
  }
}

// Initialize project hero effect
async function initProjectEffect() {
  try {
    projectHeroEffect = new ProjectHeroEffect();
    const success = await projectHeroEffect.init();
    
    if (success) {
      console.log('Project hero effect initialized');
    }
    
    return success;
  } catch (error) {
    console.error('Failed to initialize project hero effect:', error);
    return false;
  }
}

// Cleanup function
function cleanup() {
  try {
    if (portfolioApp) {
      portfolioApp.destroy();
      portfolioApp = null;
    }
    
    if (projectHeroEffect) {
      projectHeroEffect.destroy();
      projectHeroEffect = null;
    }
  } catch (error) {
    console.error('Failed to cleanup:', error);
  }
}

// Window resize handler
function handleResize() {
  try {
    store.ww = window.innerWidth;
    store.wh = window.innerHeight;
    
    if (portfolioApp) {
      portfolioApp.resize();
    }
  } catch (error) {
    console.error('Failed to handle resize:', error);
  }
}

// Page visibility handler
function handleVisibilityChange() {
  try {
    if (document.hidden) {
      // Page is hidden, pause animations if needed
      if (portfolioApp && portfolioApp.animationManager) {
        portfolioApp.animationManager.stop();
      }
    } else {
      // Page is visible, resume animations
      if (portfolioApp && portfolioApp.animationManager) {
        portfolioApp.animationManager.start();
      }
    }
  } catch (error) {
    console.error('Failed to handle visibility change:', error);
  }
}

// Barba.js page transitions
barba.init({
  transitions: [
    {
      name: 'default-transition',
      leave(data) {
        return new Promise((resolve) => {
          try {
            // Hide current page immediately
            if (data.current.container) {
              data.current.container.style.display = 'none';
            }
            
            // Cleanup current page resources
            cleanup();
            
            resolve();
          } catch (error) {
            console.error('Failed during page leave:', error);
            resolve();
          }
        });
      },
      
      beforeEnter(data) {
        try {
          // Hide next page initially to prevent flicker
          if (data.next.container) {
            data.next.container.style.display = 'none';
          }
        } catch (error) {
          console.error('Failed during beforeEnter:', error);
        }
      },
      
      enter(data) {
        return new Promise(async (resolve) => {
          try {
            // Show next page
            if (data.next.container) {
              data.next.container.style.display = 'block';
            }
            
            // Initialize based on page type
            const namespace = data.next.namespace;
            
            if (namespace === 'home') {
              // Initialize main portfolio app for home page
              await initApp();
            } else if (namespace === 'project') {
              // Initialize project hero effect for project pages
              await initProjectEffect();
              
              // Enable scrolling for project pages
              document.body.style.overflow = 'auto';
            }
            
            resolve();
          } catch (error) {
            console.error('Failed during page enter:', error);
            resolve();
          }
        });
      }
    }
  ]
});

// Event listeners
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);
document.addEventListener('visibilitychange', handleVisibilityChange);

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if we're on the home page
    const currentNamespace = document.querySelector('[data-barba-namespace]')?.getAttribute('data-barba-namespace');
    
    if (currentNamespace === 'home') {
      await initApp();
    } else if (currentNamespace === 'project') {
      await initProjectEffect();
      document.body.style.overflow = 'auto';
    }
  } catch (error) {
    console.error('Failed to initialize on DOM load:', error);
  }
});

// Error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Export for debugging
if (typeof window !== 'undefined') {
  window.portfolioApp = portfolioApp;
  window.cleanup = cleanup;
}