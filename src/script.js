import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

// Simple PIXI.js slider based on modulus concept
const store = {
  ww: window.innerWidth,
  wh: window.innerHeight,
  isDevice: navigator.userAgent.match(/Android/i)
  || navigator.userAgent.match(/webOS/i)
  || navigator.userAgent.match(/iPhone/i)
  || navigator.userAgent.match(/iPad/i)
  || navigator.userAgent.match(/iPod/i)
  || navigator.userAgent.match(/BlackBerry/i)
  || navigator.userAgent.match(/Windows Phone/i)
}

class SimplePixiSlider {
  constructor(el, opts = {}) {
    this.bindAll();
    
    this.el = el;
    this.opts = Object.assign({
      speed: store.isDevice ? 1.2 : 1.5, // Less responsive, more relaxed
      ease: store.isDevice ? 0.08 : 0.06 // Much lower ease for smoother, slower transitions
    }, opts);

    this.ui = {
      items: this.el.querySelectorAll('.js-slide'),
      projectItems: document.querySelectorAll('.project-item'),
      projectTitle: document.querySelector('.project-title'),
      projectDetails: document.querySelector('.project-details'),
      projectDescription: document.querySelector('.project-description')
    };

    this.state = {
      target: 0,
      current: 0,
      direction: 0,
      on: { x: 0, y: 0 },
      off: 0,
      flags: { dragging: false }
    };

    this.items = [];
    this.hoverTimeout = null;
    this.fadeTimeout = null;
    this.expandedIndex = null;
    this.isAnimating = false;
    
    this.events = {
      move: store.isDevice ? 'touchmove' : 'mousemove',
      up: store.isDevice ? 'touchend' : 'mouseup',
      down: store.isDevice ? 'touchstart' : 'mousedown'
    };
    
    this.init();
  }
  
  bindAll() {
    ['onDown', 'onMove', 'onUp']
    .forEach(fn => this[fn] = this[fn].bind(this));
  }

  async init() {
    await this.setupPixi();
    this.setup();
    this.on();
    
    // Description starts hidden
    if (this.ui.projectDescription) {
      this.ui.projectDescription.classList.remove('visible');
    }
  }

  async setupPixi() {
    // Create PIXI application with mobile optimizations
    this.app = new PIXI.Application();
    await this.app.init({
      width: store.ww,
      height: store.wh,
      backgroundAlpha: 0,
      antialias: !store.isDevice, // Disable on mobile for performance
      resolution: store.isDevice ? 1 : (window.devicePixelRatio || 1),
      autoDensity: true
    });

    // Add canvas to DOM
    this.app.canvas.style.position = 'fixed';
    this.app.canvas.style.top = '0';
    this.app.canvas.style.left = '0';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.pointerEvents = 'auto'; // Changed from 'none' to 'auto'
    this.app.canvas.style.zIndex = '1';
    document.body.appendChild(this.app.canvas);

    // Create container for slides
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);

    // Load textures
    this.textures = await this.loadTextures();
    
    // Add displacement filter
    this.addDisplacementFilter();
  }

  async loadTextures() {
    // Use different paths for development vs production
    const basePath = window.location.hostname === 'localhost' ? './img/' : '/portfolio_clean/';
    const imageUrls = [
      basePath + 'project-1.png',
      basePath + 'project-2.png', 
      basePath + 'project-3.png',
      basePath + 'project-4.png',
      basePath + 'project-5.png',
      basePath + 'project-6.png',
      basePath + 'project-7.png'
    ];

    const textures = {};
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        const texture = await PIXI.Assets.load(url);
        
        // Set high-quality texture settings
        texture.source.scaleMode = 'linear';
        texture.source.mipmap = true;
        
        // Store texture with both relative and absolute URL
        textures[url] = texture;
        
        // Create absolute URL to match what img.src will be
        const absoluteUrl = new URL(url, window.location.href).href;
        textures[absoluteUrl] = texture;
      } catch (error) {
        console.warn(`Failed to load texture: ${url}`, error);
      }
    }
    return textures;
  }

  addDisplacementFilter() {
    // Create a simple noise texture as fallback
    this.createNoiseTexture();
  }

  createNoiseTexture() {
    // Create canvas for noise texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Generate perlin-like noise
    const imageData = ctx.createImageData(512, 512);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const x = (i / 4) % 512;
      const y = Math.floor((i / 4) / 512);
      
      // Create wave pattern for better displacement
      const value1 = Math.sin(x * 0.01) * 127 + 128;
      const value2 = Math.cos(y * 0.01) * 127 + 128;
      const noise = (value1 + value2) / 2;
      
      imageData.data[i] = noise;     // R
      imageData.data[i + 1] = noise; // G  
      imageData.data[i + 2] = noise; // B
      imageData.data[i + 3] = 255;   // A
    }
    ctx.putImageData(imageData, 0, 0);
    
    // Create PIXI texture from canvas
    const texture = PIXI.Texture.from(canvas);
    this.displacementSprite = new PIXI.Sprite(texture);
    
    // Make it repeat - using PIXI v8 syntax
    this.displacementSprite.texture.source.style.addressMode = 'repeat';
    
    // Scale to cover screen
    const scale = Math.max(store.ww / 512, store.wh / 512);
    this.displacementSprite.scale.set(scale);
    
    // Create displacement filter
    this.displacementFilter = new PIXI.DisplacementFilter(this.displacementSprite);
    this.displacementFilter.scale.x = 0;
    this.displacementFilter.scale.y = 0;
    
    // Apply filter to container
    this.container.filters = [this.displacementFilter];
    
    // Add displacement sprite to stage
    this.app.stage.addChild(this.displacementSprite);
  }

  setup() {
    const { items } = this.ui;
    
    // Create sprites for each slide
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const { width, height } = el.getBoundingClientRect();
      
      // Get texture by index instead of img.src to avoid Vite hash mismatch
      const basePath = window.location.hostname === 'localhost' ? './img/' : '/portfolio_clean/';
      const textureUrl = basePath + `project-${i + 1}.png`;
      const texture = this.textures[textureUrl];
      
      if (texture) {
        // Create sprite
        const sprite = new PIXI.Sprite(texture);
        
        // Position sprite with centered anchor
        sprite.anchor.set(0.5, 0.5);
        sprite.x = 0; // Will be set in render
        sprite.y = store.wh / 2;
        
        // Implement object-fit: cover behavior to prevent stretching
        const containerAspect = width / height;
        const textureAspect = texture.width / texture.height;
        
        if (textureAspect > containerAspect) {
          // Texture is wider, scale by height and crop sides
          sprite.height = height;
          sprite.width = height * textureAspect;
        } else {
          // Texture is taller, scale by width and crop top/bottom
          sprite.width = width;
          sprite.height = width / textureAspect;
        }
        
        // Create a mask to crop the sprite to the container bounds
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff);
        mask.drawRect(-width/2, -height/2, width, height);
        mask.endFill();
        mask.x = 0; // Will be set in render
        mask.y = store.wh / 2;
        sprite.mask = mask;
        this.container.addChild(mask);
        
        // Make sprite interactive for hover effects
        sprite.eventMode = 'static'; // PIXI v8 syntax
        sprite.interactive = true;
        sprite.cursor = 'pointer';
        
        // Add hover and click events
        sprite.on('pointerover', () => this.onProjectHover(i));
        sprite.on('pointerout', () => this.onProjectOut(i));
        sprite.on('pointerdown', () => this.onProjectClick(i));
        
        this.container.addChild(sprite);
        
        // Calculate initial position for modulus wrapping
        const spacing = store.isDevice ? 30 : 50;
        const initialX = i * (width + spacing);
        
        // Push to cache
        this.items.push({
          el, sprite,
          width, height,
          initialX,
          projectIndex: i,
          mask: mask,
          originalScale: 1,
          targetScale: 1,
          originalZ: 0,
          targetZ: 0,
          collapsed: false
        });
      } else {
        console.warn('No texture found for index:', i, 'URL:', textureUrl);
      }
    }
  }

  calc() {
    const state = this.state;
    const prevCurrent = state.current;
    state.current += (state.target - state.current) * this.opts.ease;
    
    // Calculate direction and update displacement filter like in the example
    const scroll = state.current - prevCurrent;
    state.direction = scroll > 0 ? -1 : 1;
    
    // Update displacement filter scale based on scroll speed and direction
    if (this.displacementFilter) {
      const intensity = store.isDevice ? 4 : 8; // Less intense on mobile
      const scaleValue = intensity * state.direction * Math.abs(scroll);
      this.displacementFilter.scale.x = scaleValue;
      this.displacementFilter.scale.y = 0;
    }
  }

  render() {
    this.calc();
    this.transformItems();
  }

  transformItems() {
    // Skip normal transform if we're in expanded state or animating
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    const containerWidth = this.getContainerWidth();

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      
      if (!item || !item.sprite) continue;
      
      // Simple modulus-based positioning like the example
      const baseX = item.initialX + this.state.current;
      const wrappedX = ((baseX % containerWidth) + containerWidth) % containerWidth;
      
      // Center the sprite
      const newX = wrappedX - (containerWidth / 2) + (store.ww / 2);
      item.sprite.x = newX;
      
      // Update mask position to follow sprite
      if (item.mask) {
        item.mask.x = newX;
      }
    }
  }

  getContainerWidth() {
    // Calculate total width needed for seamless loop
    if (this.items.length === 0) return store.ww;
    const spacing = store.isDevice ? 30 : 50;
    return this.items.length * (this.items[0].width + spacing);
  }
  
  getPos({ changedTouches, clientX, clientY, target }) {
    const x = changedTouches ? changedTouches[0].clientX : clientX;
    const y = changedTouches ? changedTouches[0].clientY : clientY;
    return { x, y, target };
  }

  onDown(e) {
    // Prevent dragging when expanded
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    const { x, y } = this.getPos(e);
    const { flags, on } = this.state;
    
    flags.dragging = true;
    on.x = x;
    on.y = y;
    
    // Sync off position with current state to prevent jumping
    this.state.off = this.state.target;
  }

  onUp() {
    const state = this.state;
    state.flags.dragging = false;
    
    // Don't immediately sync off with target - let it coast naturally
    // This creates a smoother release feeling
  }

  onMove(e) {
    // Prevent dragging when expanded
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    const { x, y } = this.getPos(e);
    const state = this.state;
    
    if (!state.flags.dragging) return;

    const { off, on } = state;
    const moveX = x - on.x;
    const moveY = y - on.y;

    if ((Math.abs(moveX) > Math.abs(moveY)) && e.cancelable) {
      e.preventDefault();
      e.stopPropagation();
    }

    state.target = off + (moveX * this.opts.speed);
  }

  onWheel(e) {
    e.preventDefault();
    
    // Prevent scrolling when expanded
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    const state = this.state;
    const wheelSpeed = 15; // Even lower sensitivity for more relaxed feel
    const smoothing = 0.08; // More smoothing for gentler response
    
    // Calculate smooth wheel delta
    const deltaY = e.deltaY * smoothing;
    
    // Down scroll = positive deltaY = move right (positive direction)
    // Up scroll = negative deltaY = move left (negative direction)
    state.target += deltaY > 0 ? wheelSpeed : -wheelSpeed;
  }

  on() {
    const { move, up, down } = this.events;
    
    window.addEventListener(down, this.onDown, { passive: false });
    window.addEventListener(move, this.onMove, { passive: false });
    window.addEventListener(up, this.onUp, { passive: false });
    
    // Add wheel event for desktop scroll control
    if (!store.isDevice) {
      window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    }
  }

  off() {
    const { move, up, down } = this.events;
    
    window.removeEventListener(down, this.onDown);
    window.removeEventListener(move, this.onMove);
    window.removeEventListener(up, this.onUp);
    
    if (!store.isDevice) {
      window.removeEventListener('wheel', this.onWheel.bind(this));
    }
  }

  onProjectHover(index) {
    // Clear any pending hide timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    // Highlight corresponding project item in UI
    if (this.ui.projectItems[index]) {
      this.ui.projectItems[index].classList.add('highlighted');
    }
    
    // Start fade in after delay (shorter on mobile for better UX)
    const delay = store.isDevice ? 500 : 1000;
    this.fadeTimeout = setTimeout(() => {
      this.updateProjectDescription(index);
      if (this.ui.projectDescription) {
        this.ui.projectDescription.classList.add('visible');
      }
    }, delay);
  }

  onProjectOut(index) {
    // Cancel any pending fade in
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    
    // Remove highlight from project item
    if (this.ui.projectItems[index]) {
      this.ui.projectItems[index].classList.remove('highlighted');
    }
    
    // Fade out immediately
    if (this.ui.projectDescription) {
      this.ui.projectDescription.classList.remove('visible');
    }
  }


  onProjectClick(index) {
    console.log('Click detected on image:', index);
    if (this.isAnimating) return;
    
    if (this.expandedIndex === index) {
      // If clicking the already expanded image, collapse all
      this.collapseAll();
    } else {
      // Expand the clicked image and collapse others
      this.expandImage(index);
    }
  }

  expandImage(index) {
    console.log('Expanding image:', index);
    this.isAnimating = true;
    this.expandedIndex = index;
    
    // Stop the slider movement
    this.state.flags.dragging = false;
    
    // Get clicked item position and store original positions
    const clickedItem = this.items[index];
    const clickedX = clickedItem.sprite.x;
    
    // Store original positions for all items
    this.items.forEach((item, i) => {
      item.originalX = item.sprite.x;
      item.maskOriginalX = item.mask ? item.mask.x : item.sprite.x;
    });
    
    // First, reorder sprites so clicked image is on top
    const sortedIndices = [];
    // Add others first (background)
    for (let i = 0; i < this.items.length; i++) {
      if (i !== index) {
        sortedIndices.push(i);
      }
    }
    // Add clicked image last (foreground)
    sortedIndices.push(index);
    
    // Reorder all children in container
    const allChildren = [...this.container.children];
    
    sortedIndices.forEach((idx) => {
      const item = this.items[idx];
      // Move both sprite and mask to front
      if (item.mask) {
        this.container.setChildIndex(item.mask, this.container.children.length - 1);
      }
      this.container.setChildIndex(item.sprite, this.container.children.length - 1);
    });
    
    // Calculate center of screen
    const centerX = store.ww / 2;
    
    // Animate all items
    this.items.forEach((item, i) => {
      const distance = Math.abs(i - index);
      const isClicked = i === index;
      
      // Calculate stagger delay - closer items move first
      const delay = isClicked ? 0 : distance * 0.03;
      
      // Animate to center
      const targetX = centerX;
      
      const animProps = {
        x: item.sprite.x,
        maskX: item.mask ? item.mask.x : item.sprite.x
      };
      
      gsap.to(animProps, {
        x: targetX,
        maskX: targetX,
        duration: 1.2,
        delay: delay,
        ease: "power3.inOut",
        onUpdate: () => {
          item.sprite.x = animProps.x;
          if (item.mask) {
            item.mask.x = animProps.maskX;
          }
        },
        onComplete: () => {
          if (isClicked) {
            this.isAnimating = false;
          }
        }
      });
      
      if (!isClicked) {
        item.collapsed = true;
      }
    });
  }

  collapseAll() {
    console.log('Collapsing all images');
    this.isAnimating = true;
    this.expandedIndex = null;
    
    // Reset all items to original positions
    this.items.forEach((item, i) => {
      item.collapsed = false;
      
      // Use stored original position
      const targetX = item.originalX;
      const maskTargetX = item.maskOriginalX;
      
      // Animate back to original state
      const animProps = {
        x: item.sprite.x,
        alpha: item.sprite.alpha,
        maskX: item.mask ? item.mask.x : 0
      };
      
      gsap.to(animProps, {
        x: targetX,
        alpha: 1,
        maskX: maskTargetX,
        duration: 1.0,
        delay: i * 0.02, // Small stagger for smooth effect
        ease: "power3.inOut",
        onUpdate: () => {
          item.sprite.x = animProps.x;
          item.sprite.alpha = animProps.alpha;
          if (item.mask) {
            item.mask.x = animProps.maskX;
          }
        },
        onComplete: () => {
          if (i === this.items.length - 1) {
            this.isAnimating = false;
            // Force a render update to restore positions
            this.state.target = this.state.current;
          }
        }
      });
    });
  }

  updateProjectDescription(index) {
    const projectData = [
      {
        title: "Visual Identity Design",
        description: "Complete brand identity system including logo design, color palette, typography, and brand guidelines for a modern tech startup."
      },
      {
        title: "E-commerce Platform",
        description: "Full-stack development of a responsive e-commerce platform with custom CMS, payment integration, and advanced filtering capabilities."
      },
      {
        title: "Interactive Installation", 
        description: "Motion-activated art installation combining physical sensors with digital projections for an immersive gallery experience."
      },
      {
        title: "Mobile App Design",
        description: "UX/UI design for a fitness tracking app featuring intuitive navigation, data visualization, and seamless user experience across devices."
      },
      {
        title: "3D Product Visualization",
        description: "High-fidelity 3D modeling and rendering for product showcase, featuring realistic materials, lighting, and interactive elements."
      },
      {
        title: "Web Animation Series",
        description: "Collection of micro-interactions and animations for web interfaces, focusing on performance optimization and user engagement."
      },
      {
        title: "Digital Magazine Layout",
        description: "Editorial design for digital publication with adaptive layouts, interactive elements, and optimized reading experience."
      }
    ];

    if (index >= 0 && index < projectData.length) {
      if (this.ui.projectTitle) {
        this.ui.projectTitle.textContent = projectData[index].title;
      }
      if (this.ui.projectDetails) {
        this.ui.projectDetails.textContent = projectData[index].description;
      }
    } else {
      // Default state
      if (this.ui.projectTitle) {
        this.ui.projectTitle.textContent = "Portfolio Overview";
      }
      if (this.ui.projectDetails) {
        this.ui.projectDetails.textContent = "Hover over any project image to explore detailed information about the creative process, technologies used, and design solutions implemented.";
      }
    }
  }

  destroy() {
    this.off();
    if (this.app) {
      this.app.destroy(true, true);
    }
  }
}

// Initialize
const slider = new SimplePixiSlider(document.querySelector('.js-slider'));

const tick = () => {
  slider.render();
};

gsap.ticker.add(tick);