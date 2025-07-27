import { CONFIG, store } from './config.js';

export class EventManager {
  constructor(sliderController) {
    this.sliderController = sliderController;
    this.dragArea = null;
    this.eventListeners = new Map();
    this.isActive = false;
    
    // Bind methods
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
  }

  init(dragArea) {
    try {
      this.dragArea = dragArea;
      if (!this.dragArea) {
        throw new Error('Drag area element not provided');
      }

      this.setupEventListeners();
      this.setupProjectItemListeners();
      this.isActive = true;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize event manager:', error);
      return false;
    }
  }

  setupEventListeners() {
    try {
      // Mouse events
      this.addEventListener(this.dragArea, 'mousedown', this.onDown);
      this.addEventListener(document, 'mousemove', this.onMove);
      this.addEventListener(document, 'mouseup', this.onUp);

      // Touch events
      this.addEventListener(this.dragArea, 'touchstart', this.onDown, { passive: false });
      this.addEventListener(document, 'touchmove', this.onMove, { passive: false });
      this.addEventListener(document, 'touchend', this.onUp);

      // Other events
      this.addEventListener(window, 'resize', this.onResize);
      this.addEventListener(document, 'wheel', this.onWheel, { passive: false });
      this.addEventListener(document, 'keydown', this.onKeydown);

      // Prevent context menu
      this.addEventListener(this.dragArea, 'contextmenu', (e) => e.preventDefault());
    } catch (error) {
      console.error('Failed to setup event listeners:', error);
      throw error;
    }
  }

  setupProjectItemListeners() {
    try {
      const projectItems = document.querySelectorAll(CONFIG.SELECTORS.PROJECT_ITEM);
      
      projectItems.forEach((item, index) => {
        // Click events
        this.addEventListener(item, 'click', () => {
          this.handleProjectItemClick(index);
        });

        // Hover events
        this.addEventListener(item, 'mouseenter', () => {
          this.handleProjectItemHover(index);
        });

        this.addEventListener(item, 'mouseleave', () => {
          this.handleProjectItemLeave(index);
        });
      });
    } catch (error) {
      console.error('Failed to setup project item listeners:', error);
      throw error;
    }
  }

  addEventListener(element, event, handler, options = {}) {
    try {
      if (!element || !event || !handler) {
        throw new Error('Invalid addEventListener parameters');
      }

      element.addEventListener(event, handler, options);
      
      // Store reference for cleanup
      const key = `${element.constructor.name}_${event}_${handler.name}`;
      this.eventListeners.set(key, { element, event, handler, options });
    } catch (error) {
      console.error('Failed to add event listener:', error);
    }
  }

  onDown(e) {
    try {
      if (!this.isActive || !this.sliderController) return;

      const { sliderController } = this;
      if (sliderController.isAnimating) return;

      e.preventDefault();
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      sliderController.state.on.x = clientX;
      sliderController.state.on.y = clientY;
      sliderController.state.flags.dragging = true;

      if (this.dragArea) {
        this.dragArea.style.cursor = 'grabbing';
      }
    } catch (error) {
      console.error('Failed to handle down event:', error);
    }
  }

  onMove(e) {
    try {
      if (!this.isActive || !this.sliderController) return;

      const { sliderController } = this;
      const { state } = sliderController;
      
      if (!state.flags.dragging) return;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const off = (state.on.x - clientX) * sliderController.opts.speed;

      state.target = state.off + off;
    } catch (error) {
      console.error('Failed to handle move event:', error);
    }
  }

  onUp(e) {
    try {
      if (!this.isActive || !this.sliderController) return;

      const { sliderController } = this;
      const { state } = sliderController;

      if (!state.flags.dragging) return;

      state.off = state.target;
      state.flags.dragging = false;

      if (this.dragArea) {
        this.dragArea.style.cursor = 'grab';
      }
    } catch (error) {
      console.error('Failed to handle up event:', error);
    }
  }

  onWheel(e) {
    try {
      if (!this.isActive || !this.sliderController) return;

      // Check if we're on a project page (should allow normal scrolling)
      if (document.querySelector('.project-content')) {
        return; // Let normal scroll behavior work
      }

      e.preventDefault();
      
      const { sliderController } = this;
      const delta = e.deltaY > 0 ? 1 : -1;
      const speed = store.isDevice ? 0.5 : 1;
      
      sliderController.state.target += delta * speed * CONFIG.SLIDER.ITEM_SIZE;
      sliderController.state.off = sliderController.state.target;
    } catch (error) {
      console.error('Failed to handle wheel event:', error);
    }
  }

  onKeydown(e) {
    try {
      if (!this.isActive || !this.sliderController) return;
      
      // Check if we're on a project page
      if (document.querySelector('.project-content')) {
        return;
      }

      const { sliderController } = this;
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft':
          sliderController.state.target -= CONFIG.SLIDER.ITEM_SIZE;
          handled = true;
          break;
        case 'ArrowRight':
          sliderController.state.target += CONFIG.SLIDER.ITEM_SIZE;
          handled = true;
          break;
        case 'Home':
          sliderController.state.target = 0;
          handled = true;
          break;
        case 'End':
          sliderController.state.target = -(sliderController.items.length - 1) * CONFIG.SLIDER.ITEM_SIZE;
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        sliderController.state.off = sliderController.state.target;
      }
    } catch (error) {
      console.error('Failed to handle keydown event:', error);
    }
  }

  onResize() {
    try {
      if (!this.isActive || !this.sliderController) return;

      // Update store dimensions
      store.ww = window.innerWidth;
      store.wh = window.innerHeight;

      // Resize renderer
      if (this.sliderController.renderer) {
        this.sliderController.renderer.resize(store.ww, store.wh);
      }

      // Resize slider
      this.sliderController.resize();
    } catch (error) {
      console.error('Failed to handle resize event:', error);
    }
  }

  handleProjectItemClick(index) {
    try {
      if (!this.sliderController) return;

      const success = this.sliderController.navigateToProject(index);
      if (success) {
        // Navigate to project page
        const projectUrl = `project-${index + 1}.html`;
        window.location.href = projectUrl;
      }
    } catch (error) {
      console.error('Failed to handle project item click:', error);
    }
  }

  handleProjectItemHover(index) {
    try {
      if (!this.sliderController) return;

      // Clear any existing timeouts
      if (this.sliderController.hoverTimeout) {
        clearTimeout(this.sliderController.hoverTimeout);
      }
      if (this.sliderController.fadeTimeout) {
        clearTimeout(this.sliderController.fadeTimeout);
      }

      // Navigate to project with delay
      this.sliderController.hoverTimeout = setTimeout(() => {
        this.sliderController.navigateToProject(index);
        
        // Show description with delay
        this.sliderController.fadeTimeout = setTimeout(() => {
          const description = document.querySelector(CONFIG.SELECTORS.PROJECT_DESCRIPTION);
          if (description) {
            description.classList.add('visible');
          }
        }, CONFIG.ANIMATION.FADE_DELAY);
      }, CONFIG.ANIMATION.HOVER_DELAY);
    } catch (error) {
      console.error('Failed to handle project item hover:', error);
    }
  }

  handleProjectItemLeave(index) {
    try {
      if (!this.sliderController) return;

      // Clear timeouts
      if (this.sliderController.hoverTimeout) {
        clearTimeout(this.sliderController.hoverTimeout);
        this.sliderController.hoverTimeout = null;
      }
      if (this.sliderController.fadeTimeout) {
        clearTimeout(this.sliderController.fadeTimeout);
        this.sliderController.fadeTimeout = null;
      }

      // Hide description
      const description = document.querySelector(CONFIG.SELECTORS.PROJECT_DESCRIPTION);
      if (description) {
        description.classList.remove('visible');
      }

      // Remove highlights
      const projectItems = document.querySelectorAll(CONFIG.SELECTORS.PROJECT_ITEM);
      if (projectItems[index]) {
        projectItems[index].classList.remove('highlighted');
      }
    } catch (error) {
      console.error('Failed to handle project item leave:', error);
    }
  }

  destroy() {
    try {
      this.isActive = false;

      // Remove all event listeners
      this.eventListeners.forEach(({ element, event, handler, options }) => {
        try {
          element.removeEventListener(event, handler, options);
        } catch (error) {
          console.warn('Failed to remove event listener:', error);
        }
      });

      this.eventListeners.clear();
      this.dragArea = null;
      this.sliderController = null;
    } catch (error) {
      console.error('Failed to destroy event manager:', error);
    }
  }
}