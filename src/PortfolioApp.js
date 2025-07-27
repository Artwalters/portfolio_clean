import * as PIXI from 'pixi.js';
import { PixiRenderer } from './PixiRenderer.js';
import { SliderController } from './SliderController.js';
import { EventManager } from './EventManager.js';
import { AnimationManager } from './AnimationManager.js';
import { CONFIG } from './config.js';

export class PortfolioApp {
  constructor() {
    this.renderer = null;
    this.sliderController = null;
    this.eventManager = null;
    this.animationManager = null;
    this.isInitialized = false;
    this.isDestroyed = false;
  }

  async init() {
    try {
      if (this.isInitialized) {
        console.warn('PortfolioApp already initialized');
        return true;
      }

      console.log('Initializing PortfolioApp...');

      // Initialize renderer
      this.renderer = new PixiRenderer();
      const rendererSuccess = await this.renderer.init();
      if (!rendererSuccess) {
        throw new Error('Failed to initialize renderer');
      }

      // Initialize slider controller
      this.sliderController = new SliderController(this.renderer);
      const sliderElement = document.querySelector('.js-drag-area');
      if (!sliderElement) {
        throw new Error('Slider element not found');
      }
      
      const sliderSuccess = this.sliderController.init(sliderElement);
      if (!sliderSuccess) {
        throw new Error('Failed to initialize slider controller');
      }

      // Load slider items
      const itemsLoaded = await this.sliderController.loadItems();
      if (!itemsLoaded) {
        throw new Error('Failed to load slider items');
      }

      // Initialize animation manager
      this.animationManager = new AnimationManager(this.sliderController);
      const animationSuccess = this.animationManager.init();
      if (!animationSuccess) {
        throw new Error('Failed to initialize animation manager');
      }

      // Initialize event manager
      this.eventManager = new EventManager(this.sliderController);
      const eventSuccess = this.eventManager.init(sliderElement);
      if (!eventSuccess) {
        throw new Error('Failed to initialize event manager');
      }

      this.isInitialized = true;
      console.log('PortfolioApp initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize PortfolioApp:', error);
      
      // Cleanup on failure
      this.destroy();
      return false;
    }
  }

  resize() {
    try {
      if (!this.isInitialized || this.isDestroyed) return;

      if (this.renderer) {
        this.renderer.resize(window.innerWidth, window.innerHeight);
      }

      if (this.sliderController) {
        this.sliderController.resize();
      }
    } catch (error) {
      console.error('Failed to resize app:', error);
    }
  }

  destroy() {
    try {
      if (this.isDestroyed) return;

      console.log('Destroying PortfolioApp...');

      // Destroy in reverse order of creation
      if (this.eventManager) {
        this.eventManager.destroy();
        this.eventManager = null;
      }

      if (this.animationManager) {
        this.animationManager.destroy();
        this.animationManager = null;
      }

      if (this.sliderController) {
        this.sliderController.destroy();
        this.sliderController = null;
      }

      if (this.renderer) {
        this.renderer.destroy();
        this.renderer = null;
      }

      this.isInitialized = false;
      this.isDestroyed = true;

      console.log('PortfolioApp destroyed successfully');
    } catch (error) {
      console.error('Failed to destroy PortfolioApp:', error);
    }
  }
}

// Project Hero Effect class for project pages
export class ProjectHeroEffect {
  constructor() {
    this.app = null;
    this.displacementSprite = null;
    this.displacementFilter = null;
    this.heroImage = null;
    this.isInitialized = false;
  }

  async init() {
    try {
      const heroImage = document.querySelector(CONFIG.SELECTORS.PROJECT_HERO_IMAGE);
      if (!heroImage) {
        console.log('No project hero image found');
        return false;
      }

      this.heroImage = heroImage;

      // Create PIXI application
      this.app = new PIXI.Application();
      await this.app.init({
        width: heroImage.offsetWidth,
        height: heroImage.offsetHeight,
        backgroundColor: 0xFFFFFF,
        backgroundAlpha: 0,
        antialias: CONFIG.PIXI.ANTIALIAS,
        resolution: CONFIG.PIXI.RESOLUTION
      });

      // Position canvas exactly over the image
      this.app.canvas.style.position = 'absolute';
      this.app.canvas.style.left = '0';
      this.app.canvas.style.top = '0';
      this.app.canvas.style.width = '100%';
      this.app.canvas.style.height = '100%';
      this.app.canvas.style.pointerEvents = 'none';

      // Hide the original image initially to prevent flicker
      heroImage.style.opacity = '0';

      // Create sprite from image
      const texture = await PIXI.Assets.load(heroImage.src);
      const sprite = new PIXI.Sprite(texture);
      
      // Scale sprite to fit exactly
      sprite.width = heroImage.offsetWidth;
      sprite.height = heroImage.offsetHeight;
      
      // Create displacement filter
      const displacementTexture = await PIXI.Assets.load('./img/displacement.jpg');
      this.displacementSprite = new PIXI.Sprite(displacementTexture);
      this.displacementFilter = new PIXI.DisplacementFilter({
        sprite: this.displacementSprite,
        scale: { x: 30, y: 60 }
      });

      // Add filter to sprite
      sprite.filters = [this.displacementFilter];
      
      // Add to stage
      this.app.stage.addChild(this.displacementSprite);
      this.app.stage.addChild(sprite);

      // Insert canvas before the image
      heroImage.parentNode.insertBefore(this.app.canvas, heroImage);

      // Show the canvas and fade in
      this.app.canvas.style.opacity = '1';

      // Animate displacement
      this.app.ticker.add(() => {
        if (this.displacementSprite) {
          this.displacementSprite.x += 2;
          this.displacementSprite.y += 1;
        }
      });

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('Failed to initialize project hero effect:', error);
      
      // Show original image on error
      if (this.heroImage) {
        this.heroImage.style.opacity = '1';
      }
      
      return false;
    }
  }

  destroy() {
    try {
      if (this.app) {
        this.app.destroy(true, { children: true, texture: true });
        this.app = null;
      }

      if (this.heroImage) {
        this.heroImage.style.opacity = '1';
        this.heroImage = null;
      }

      this.displacementSprite = null;
      this.displacementFilter = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to destroy project hero effect:', error);
    }
  }
}