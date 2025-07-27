import { gsap } from 'gsap';
import { CONFIG } from './config.js';

export class AnimationManager {
  constructor(sliderController) {
    this.sliderController = sliderController;
    this.timeline = null;
    this.isRunning = false;
    this.animationFrame = null;
    
    // Bind methods
    this.render = this.render.bind(this);
  }

  init() {
    try {
      // Create main timeline
      this.timeline = gsap.timeline({ paused: true });
      
      // Start render loop
      this.start();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize animation manager:', error);
      return false;
    }
  }

  start() {
    try {
      if (this.isRunning) return;
      
      this.isRunning = true;
      this.render();
    } catch (error) {
      console.error('Failed to start animation:', error);
    }
  }

  stop() {
    try {
      this.isRunning = false;
      
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    } catch (error) {
      console.error('Failed to stop animation:', error);
    }
  }

  render() {
    try {
      if (!this.isRunning || !this.sliderController) return;

      const { sliderController } = this;
      const { state } = sliderController;

      // Update current position with easing
      const diff = state.target - state.current;
      state.current += diff * sliderController.opts.ease;

      // Calculate direction and velocity for shaders
      state.direction = diff > 0 ? 1 : -1;
      const velocity = Math.abs(diff) * 0.1;

      // Update positions
      sliderController.updateItemPositions();
      sliderController.updateProgress();

      // Update PIXI uniforms
      if (sliderController.renderer) {
        sliderController.renderer.updateUniforms(
          performance.now() * 0.001,
          velocity,
          state.direction
        );
      }

      // Update project highlighting
      this.updateProjectHighlighting();

      // Continue render loop
      this.animationFrame = requestAnimationFrame(this.render);
    } catch (error) {
      console.error('Failed to render frame:', error);
      // Continue render loop even on error
      if (this.isRunning) {
        this.animationFrame = requestAnimationFrame(this.render);
      }
    }
  }

  updateProjectHighlighting() {
    try {
      if (!this.sliderController || !this.sliderController.ui.projectItems) return;

      const currentIndex = this.sliderController.getCurrentIndex();
      const projectItems = this.sliderController.ui.projectItems;

      projectItems.forEach((item, index) => {
        try {
          if (index === currentIndex) {
            item.classList.add('selected');
            item.classList.remove('highlighted');
          } else {
            item.classList.remove('selected', 'highlighted');
          }
        } catch (itemError) {
          console.warn(`Failed to update project item ${index}:`, itemError);
        }
      });

      // Update project info
      this.sliderController.updateProjectInfo(currentIndex);
    } catch (error) {
      console.error('Failed to update project highlighting:', error);
    }
  }

  animateToProject(index, duration = CONFIG.ANIMATION.TRANSITION_DURATION) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.sliderController || this.sliderController.isAnimating) {
          reject(new Error('Slider not ready or already animating'));
          return;
        }

        this.sliderController.isAnimating = true;
        
        const targetPosition = -(index * CONFIG.SLIDER.ITEM_SIZE);
        
        gsap.to(this.sliderController.state, {
          target: targetPosition,
          duration,
          ease: "power2.out",
          onUpdate: () => {
            this.sliderController.state.off = this.sliderController.state.target;
          },
          onComplete: () => {
            this.sliderController.isAnimating = false;
            this.sliderController.updateProjectInfo(index);
            resolve();
          },
          onError: (error) => {
            this.sliderController.isAnimating = false;
            reject(error);
          }
        });
      } catch (error) {
        this.sliderController.isAnimating = false;
        reject(error);
      }
    });
  }

  expandItem(index, scale = 1.1, duration = CONFIG.ANIMATION.EXPAND_DURATION) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.sliderController || !this.sliderController.items[index]) {
          reject(new Error('Invalid item index'));
          return;
        }

        const item = this.sliderController.items[index];
        const mesh = item.mesh;

        if (!mesh) {
          reject(new Error('Mesh not found'));
          return;
        }

        gsap.to(mesh.scale, {
          x: scale,
          y: scale,
          duration,
          ease: "power2.out",
          onComplete: resolve,
          onError: reject
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  contractItem(index, duration = CONFIG.ANIMATION.EXPAND_DURATION) {
    return this.expandItem(index, 1, duration);
  }

  fadeElement(element, opacity = 1, duration = CONFIG.ANIMATION.FADE_DURATION) {
    return new Promise((resolve, reject) => {
      try {
        if (!element) {
          reject(new Error('Element not provided'));
          return;
        }

        gsap.to(element, {
          opacity,
          duration,
          ease: "power2.out",
          onComplete: resolve,
          onError: reject
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  slideElement(element, x = 0, y = 0, duration = CONFIG.ANIMATION.TRANSITION_DURATION) {
    return new Promise((resolve, reject) => {
      try {
        if (!element) {
          reject(new Error('Element not provided'));
          return;
        }

        gsap.to(element, {
          x,
          y,
          duration,
          ease: "power2.out",
          onComplete: resolve,
          onError: reject
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  scaleElement(element, scaleX = 1, scaleY = 1, duration = CONFIG.ANIMATION.EXPAND_DURATION) {
    return new Promise((resolve, reject) => {
      try {
        if (!element) {
          reject(new Error('Element not provided'));
          return;
        }

        gsap.to(element, {
          scaleX,
          scaleY,
          duration,
          ease: "power2.out",
          onComplete: resolve,
          onError: reject
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  killAllAnimations() {
    try {
      gsap.killTweensOf("*");
      
      if (this.timeline) {
        this.timeline.kill();
        this.timeline = null;
      }

      if (this.sliderController) {
        this.sliderController.isAnimating = false;
      }
    } catch (error) {
      console.error('Failed to kill animations:', error);
    }
  }

  destroy() {
    try {
      this.stop();
      this.killAllAnimations();
      
      this.sliderController = null;
      this.timeline = null;
    } catch (error) {
      console.error('Failed to destroy animation manager:', error);
    }
  }
}