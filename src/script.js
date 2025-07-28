//! ========================================
//! 1. IMPORTS EN GLOBAL STORE CONFIGURATIE
//! ========================================

import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import barba from '@barba/core';

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

// Fix mobile viewport height issue for consistent positioning
function updateViewportHeight() {
  // Use actual viewport height for both CSS and JS
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Initialize viewport height fix
updateViewportHeight();
window.addEventListener('resize', updateViewportHeight);

//! ========================================
//! 2. SIMPLERPIXISLIDER CLASS - CONSTRUCTOR & INITIALISATIE
//! ========================================

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
      flags: { dragging: false },
      isVertical: store.isDevice, // Mobile = vertical, Desktop = horizontal
      clickStart: { x: 0, y: 0, time: 0 },
      hasMoved: false
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
    ['onDown', 'onMove', 'onUp', 'onWheel']
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

  //! ========================================
  //! 3. PIXI.JS SETUP & TEXTURE LOADING
  //! ========================================

  async setupPixi() {
    // Create PIXI application with mobile optimizations
    this.app = new PIXI.Application();
    await this.app.init({
      width: store.ww,
      height: store.wh,
      backgroundAlpha: 0,
      antialias: true, // Enable antialiasing for both mobile and desktop
      resolution: window.devicePixelRatio || 1, // Use device pixel ratio for all devices
      autoDensity: true
    });

    // Add canvas to DOM with pixel-perfect rendering
    this.app.canvas.style.position = 'fixed';
    this.app.canvas.style.top = '0';
    this.app.canvas.style.left = '0';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.pointerEvents = 'auto';
    this.app.canvas.style.zIndex = '1';
    // Optimize canvas rendering for crisp images
    this.app.canvas.style.imageRendering = 'pixelated';
    this.app.canvas.style.imageRendering = '-moz-crisp-edges';
    this.app.canvas.style.imageRendering = 'crisp-edges';
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
    
    // Check if assets are already loaded to prevent cache warnings
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        let texture;
        
        // Check if already in cache
        if (PIXI.Assets.cache.has(url)) {
          texture = PIXI.Assets.cache.get(url);
        } else {
          texture = await PIXI.Assets.load(url);
          
          // Set high-quality texture settings
          texture.source.scaleMode = 'linear';
          texture.source.mipmap = true;
        }
        
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
    
    // Create PIXI texture from canvas with proper style
    const texture = PIXI.Texture.from(canvas);
    
    // Set texture style using PIXI v8 syntax
    if (texture.source && texture.source.style) {
      texture.source.style.addressMode = 'repeat';
      texture.source.style.addressModeU = 'repeat';
      texture.source.style.addressModeV = 'repeat';
    }
    
    this.displacementSprite = new PIXI.Sprite(texture);
    
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
        if (store.isDevice) {
          // Mobile: vertical layout
          sprite.x = store.ww / 2;
          sprite.y = 0; // Will be set in render
        } else {
          // Desktop: horizontal layout
          sprite.x = 0; // Will be set in render
          sprite.y = store.wh / 2;
        }
        
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
        mask.rect(-width/2, -height/2, width, height);
        mask.fill(0xffffff);
        if (store.isDevice) {
          // Mobile: vertical layout
          mask.x = store.ww / 2;
          mask.y = 0; // Will be set in render
        } else {
          // Desktop: horizontal layout
          mask.x = 0; // Will be set in render
          mask.y = store.wh / 2;
        }
        sprite.mask = mask;
        this.container.addChild(mask);
        
        // Make sprite interactive for hover effects
        sprite.eventMode = 'static'; // PIXI v8 syntax
        sprite.interactive = true;
        sprite.cursor = 'pointer';
        
        // Add hover and click events
        sprite.on('pointerover', () => this.onProjectHover(i));
        sprite.on('pointerout', () => this.onProjectOut(i));
        sprite.on('pointerdown', (e) => this.onProjectDown(i, e));
        sprite.on('pointerup', (e) => this.onProjectUp(i, e));
        
        this.container.addChild(sprite);
        
        // Calculate initial position for modulus wrapping
        const spacing = store.isDevice ? 30 : 50;
        const initialX = store.isDevice ? 0 : i * (width + spacing);
        const initialY = store.isDevice ? i * (height + spacing) : 0;
        
        // Push to cache
        this.items.push({
          el, sprite,
          width, height,
          initialX,
          initialY,
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

  //! ========================================
  //! 4. SLIDER INTERACTIE - MOUSE/TOUCH EVENTS & RENDERING
  //! ========================================

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
      if (store.isDevice) {
        // Mobile: vertical displacement
        this.displacementFilter.scale.x = 0;
        this.displacementFilter.scale.y = scaleValue;
      } else {
        // Desktop: horizontal displacement
        this.displacementFilter.scale.x = scaleValue;
        this.displacementFilter.scale.y = 0;
      }
    }
  }

  render() {
    this.calc();
    this.transformItems();
  }

  transformItems() {
    // Skip normal transform if we're in expanded state or animating
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    if (store.isDevice) {
      // Mobile: vertical scrolling
      const containerHeight = this.getContainerHeight();

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        
        if (!item || !item.sprite) continue;
        
        // Simple modulus-based positioning for vertical
        const baseY = item.initialY + this.state.current;
        const wrappedY = ((baseY % containerHeight) + containerHeight) % containerHeight;
        
        // Center the sprite vertically
        const newY = wrappedY - (containerHeight / 2) + (store.wh / 2);
        item.sprite.y = newY;
        
        // Update mask position to follow sprite
        if (item.mask) {
          item.mask.y = newY;
        }
      }
    } else {
      // Desktop: horizontal scrolling
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
  }

  getContainerWidth() {
    // Calculate total width needed for seamless loop
    if (this.items.length === 0) return store.ww;
    const spacing = store.isDevice ? 30 : 50;
    return this.items.length * (this.items[0].width + spacing);
  }
  
  getContainerHeight() {
    // Calculate total height needed for seamless loop on mobile
    if (this.items.length === 0) return store.wh;
    const spacing = store.isDevice ? 30 : 50;
    return this.items.length * (this.items[0].height + spacing);
  }
  
  getPos({ changedTouches, clientX, clientY, target }) {
    const x = changedTouches ? changedTouches[0].clientX : clientX;
    const y = changedTouches ? changedTouches[0].clientY : clientY;
    return { x, y, target };
  }

  onDown(e) {
    // Prevent dragging when expanded
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    // Interrupt intro animation if still running
    if (this.introAnimation && this.introAnimation.isActive()) {
      this.introAnimation.kill();
      this.introAnimation = null;
    }
    
    const { x, y } = this.getPos(e);
    const { flags, on, clickStart } = this.state;
    
    flags.dragging = true;
    on.x = x;
    on.y = y;
    
    // Store click start position and time for click detection
    clickStart.x = x;
    clickStart.y = y;
    clickStart.time = Date.now();
    this.state.hasMoved = false;
    
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

    const { off, on, clickStart } = state;
    const moveX = x - on.x;
    const moveY = y - on.y;
    
    // Calculate distance from start position to detect movement
    const distanceFromStart = Math.sqrt(
      Math.pow(x - clickStart.x, 2) + Math.pow(y - clickStart.y, 2)
    );
    
    // Mark as moved if distance is significant (prevents accidental clicks)
    const moveThreshold = store.isDevice ? 10 : 5; // Higher threshold on mobile
    if (distanceFromStart > moveThreshold) {
      state.hasMoved = true;
    }

    if (store.isDevice) {
      // Mobile: vertical scrolling
      if ((Math.abs(moveY) > Math.abs(moveX)) && e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
      state.target = off + (moveY * this.opts.speed);
    } else {
      // Desktop: horizontal scrolling
      if ((Math.abs(moveX) > Math.abs(moveY)) && e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
      state.target = off + (moveX * this.opts.speed);
    }
  }

  onWheel(e) {
    e.preventDefault();
    
    // Prevent scrolling when expanded
    if (this.expandedIndex !== null || this.isAnimating) return;
    
    // Interrupt intro animation if still running
    if (this.introAnimation && this.introAnimation.isActive()) {
      this.introAnimation.kill();
      this.introAnimation = null;
    }
    
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
      window.addEventListener('wheel', this.onWheel, { passive: false });
    }
  }

  off() {
    const { move, up, down } = this.events;
    
    window.removeEventListener(down, this.onDown);
    window.removeEventListener(move, this.onMove);
    window.removeEventListener(up, this.onUp);
    
    if (!store.isDevice) {
      window.removeEventListener('wheel', this.onWheel);
    }
  }

  onProjectHover(index) {
    // Clear any pending fade in timeout
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
    
    // Clear any pending hide timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    
    // Highlight corresponding project item in UI
    if (this.ui.projectItems[index]) {
      this.ui.projectItems[index].classList.add('highlighted');
    }
    
    // Always ensure fade-out happens first
    if (this.ui.projectDescription) {
      this.ui.projectDescription.classList.remove('visible');
    }
    
    // Wait for fade-out to complete, then wait additional delay before fade-in
    const fadeOutDelay = 200; // Time for CSS transition to complete
    const hoverDelay = store.isDevice ? 500 : 1000; // Original hover delay
    const totalDelay = fadeOutDelay + hoverDelay;
    
    this.fadeTimeout = setTimeout(() => {
      if (this.ui.projectDescription) {
        const projectNames = [
          "Project 1 - Creative Visual Identity",
          "Project 2 - Interactive Web Experience", 
          "Project 3 - Brand Strategy & Design",
          "Project 4 - Digital Art Installation",
          "Project 5 - Motion Graphics Campaign",
          "Project 6 - Editorial Design System",
          "Project 7 - Experimental Typography"
        ];
        
        this.ui.projectDescription.textContent = projectNames[index] || "Project details";
        this.ui.projectDescription.classList.add('visible');
      }
    }, totalDelay);
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
    
    // Reset description and fade out
    if (this.ui.projectDescription) {
      this.ui.projectDescription.textContent = "Project details appear on hover.";
      this.ui.projectDescription.classList.remove('visible');
    }
  }

  //! ========================================
  //! 5. IMAGE EXPAND/COLLAPSE ANIMATIES
  //! ========================================

  onProjectDown(index, e) {
    // Store which sprite was pressed for potential click
    this.state.pressedSpriteIndex = index;
  }
  
  onProjectUp(index, e) {
    // Only trigger click if:
    // 1. Same sprite that was pressed down
    // 2. No significant movement occurred
    // 3. Not too much time has passed (prevents long press)
    // 4. Not currently animating
    
    if (this.isAnimating) return;
    if (this.state.pressedSpriteIndex !== index) return;
    
    const timeDiff = Date.now() - this.state.clickStart.time;
    const maxClickTime = 500; // Max 500ms for a valid click
    
    if (!this.state.hasMoved && timeDiff < maxClickTime) {
      // Valid click detected!
      this.onProjectClick(index);
    }
    
    // Reset pressed sprite
    this.state.pressedSpriteIndex = null;
  }

  onProjectClick(index) {
    if (this.expandedIndex === index) {
      // If clicking the already expanded image, collapse all
      this.collapseAll();
    } else {
      // No need to store index - each page has its own URL
      // Expand the clicked image and collapse others
      this.expandImage(index);
    }
  }

  expandImage(index) {
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
      item.originalY = item.sprite.y;
      item.maskOriginalX = item.mask ? item.mask.x : item.sprite.x;
      item.maskOriginalY = item.mask ? item.mask.y : item.sprite.y;
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
    const centerY = store.wh / 2;
    
    // Animate all items
    this.items.forEach((item, i) => {
      const distance = Math.abs(i - index);
      const isClicked = i === index;
      
      // Calculate stagger delay - closer items move first
      const delay = isClicked ? 0 : distance * 0.03;
      
      // All images animate to exact center on both mobile and desktop
      const targetX = centerX;
      const targetY = centerY;
      
      const animProps = {
        x: item.sprite.x,
        y: item.sprite.y,
        maskX: item.mask ? item.mask.x : item.sprite.x,
        maskY: item.mask ? item.mask.y : item.sprite.y
      };
      
      gsap.to(animProps, {
        x: targetX,
        y: targetY,
        maskX: targetX,
        maskY: targetY,
        duration: 1.2,
        delay: delay,
        ease: "power3.inOut",
        onUpdate: () => {
          // Check if sprite still exists before updating
          if (item.sprite && item.sprite.parent) {
            item.sprite.x = animProps.x;
            item.sprite.y = animProps.y;
          }
          if (item.mask && item.mask.parent) {
            item.mask.x = animProps.maskX;
            item.mask.y = animProps.maskY;
          }
        },
        onComplete: () => {
          if (isClicked) {
            this.isAnimating = false;
            
            // Capture the final sprite state
            console.log('Capturing sprite for index:', index);
            const dataUrl = this.captureSprite(item);
            const htmlImage = this.createHTMLTransitionImage(item, dataUrl);
            
            // Store for transition
            window.transitionImage = htmlImage;
            window.finalSpritePosition = {
              x: item.sprite.x,
              y: item.sprite.y,
              scale: item.sprite.scale.x
            };
            
            console.log('Transition image created, navigating...');
            
            // Navigate to specific project page
            barba.go(`./project-${index + 1}.html`);
          }
        }
      });
      
      if (!isClicked) {
        item.collapsed = true;
      }
    });
  }

  collapseAll() {
    this.isAnimating = true;
    this.expandedIndex = null;
    
    // Reset all items to original positions
    this.items.forEach((item, i) => {
      item.collapsed = false;
      
      // Use stored original position
      const targetX = item.originalX;
      const targetY = item.originalY || item.sprite.y;
      const maskTargetX = item.maskOriginalX;
      const maskTargetY = item.maskOriginalY || (item.mask ? item.mask.y : 0);
      
      // Animate back to original state
      const animProps = {
        x: item.sprite.x,
        y: item.sprite.y,
        alpha: item.sprite.alpha,
        maskX: item.mask ? item.mask.x : 0,
        maskY: item.mask ? item.mask.y : 0
      };
      
      gsap.to(animProps, {
        x: targetX,
        y: targetY,
        alpha: 1,
        maskX: maskTargetX,
        maskY: maskTargetY,
        duration: 1.0,
        delay: i * 0.02, // Small stagger for smooth effect
        ease: "power3.inOut",
        onUpdate: () => {
          // Check if sprite still exists before updating
          if (item.sprite && item.sprite.parent) {
            item.sprite.x = animProps.x;
            item.sprite.y = animProps.y;
            item.sprite.alpha = animProps.alpha;
          }
          if (item.mask && item.mask.parent) {
            item.mask.x = animProps.maskX;
            item.mask.y = animProps.maskY;
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

  captureSprite(item) {
    // Create a temporary render texture to capture the sprite - exact same size
    const renderTexture = PIXI.RenderTexture.create({
      width: item.width,
      height: item.height
    });
    
    // Create a temporary container for clean rendering
    const tempContainer = new PIXI.Container();
    const tempSprite = new PIXI.Sprite(item.sprite.texture);
    
    // Copy sprite properties - exact same scale
    tempSprite.anchor.set(0.5);
    tempSprite.scale.set(item.sprite.scale.x);
    tempSprite.x = item.width / 2;
    tempSprite.y = item.height / 2;
    
    // Create matching mask for clean crop - exact same size
    const tempMask = new PIXI.Graphics();
    tempMask.rect(0, 0, item.width, item.height);
    tempMask.fill(0xffffff);
    
    // Set mask without affecting original sprite
    tempSprite.mask = tempMask;
    
    tempContainer.addChild(tempMask);
    tempContainer.addChild(tempSprite);
    
    // Render to texture using PIXI v8 syntax
    this.app.renderer.render({
      container: tempContainer,
      target: renderTexture
    });
    
    // Convert to canvas
    const canvas = this.app.renderer.extract.canvas(renderTexture);
    
    // Clean up properly to avoid texture warnings
    // Remove mask first to avoid issues
    tempSprite.mask = null;
    
    // Destroy children individually
    tempMask.destroy();
    tempSprite.destroy({
      texture: false, // Don't destroy the original texture
      baseTexture: false
    });
    
    // Destroy container
    tempContainer.destroy({
      children: false, // Already destroyed manually
      texture: false,
      baseTexture: false
    });
    
    // Destroy render texture
    renderTexture.destroy(true);
    
    return canvas.toDataURL();
  }

  createHTMLTransitionImage(item, dataUrl) {
    // Create HTML image element for transition
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.position = 'fixed';
    img.style.width = `${item.width}px`;  // Exact same size, no scaling
    img.style.height = `${item.height}px`; // Exact same size, no scaling  
    img.style.left = `${item.sprite.x - item.width / 2}px`;
    img.style.top = `${item.sprite.y - item.height / 2}px`;
    img.style.zIndex = '9999';
    img.style.objectFit = 'cover';
    img.style.transition = 'none';
    img.style.opacity = '1'; // Start visible
    img.style.pointerEvents = 'none';
    img.className = 'transition-image';
    
    document.body.appendChild(img);
    return img;
  }


  async destroy() {
    this.off();
    
    // Kill all GSAP animations to prevent errors
    gsap.killTweensOf(this.items);
    this.items.forEach(item => {
      if (item.sprite) gsap.killTweensOf(item.sprite);
      if (item.mask) gsap.killTweensOf(item.mask);
    });
    
    
    // Clean up items array
    this.items.forEach(item => {
      if (item.sprite) {
        item.sprite.mask = null;
        if (item.sprite.parent) {
          item.sprite.parent.removeChild(item.sprite);
        }
      }
      if (item.mask && item.mask.parent) {
        item.mask.parent.removeChild(item.mask);
      }
    });
    this.items = [];
    
    // Properly unload assets using PIXI v8 Assets API
    try {
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
      
      // Unload assets properly
      await PIXI.Assets.unload(imageUrls);
    } catch (error) {
      console.warn('Error unloading assets:', error);
    }
    
    if (this.app) {
      this.app.destroy(true, true);
    }
  }
}

//! ========================================
//! 6. PROJECTHEROEFFECT CLASS VOOR PROJECT DETAIL PAGINA'S
//! ========================================

// Project Hero Effect class for project pages
class ProjectHeroEffect {
  constructor() {
    this.app = null;
    this.displacementSprite = null;
    this.displacementFilter = null;
    this.heroImage = null;
    this.isInitialized = false;
    this.sprite = null;
    this.currentImageIndex = 0;
    this.galleryImages = [];
    this.isTransitioning = false;
  }

  async init() {
    try {
      const heroImage = document.querySelector('.project-hero-image');
      if (!heroImage) {
        console.log('No project hero image found');
        return false;
      }

      // Setup gallery images
      await this.setupGallery(heroImage);

      this.heroImage = heroImage;

      // Get the actual displayed dimensions of the image as it appears in CSS
      const rect = heroImage.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;

      // DON'T modify any positioning - CSS already handles everything correctly
      const parent = heroImage.parentElement;

      // Create PIXI application with proper dimensions
      this.app = new PIXI.Application();
      await this.app.init({
        width: displayWidth,
        height: displayHeight,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true, // Enable antialiasing for project hero images too
        resolution: window.devicePixelRatio || 1 // Use device pixel ratio
      });

      // Create sprite from image - preload texture
      const texture = await PIXI.Assets.load(heroImage.src);
      if (!texture || !texture.source) {
        throw new Error('Failed to load texture properly');
      }
      
      const sprite = new PIXI.Sprite(texture);
      
      // Position sprite with centered anchor (same as slider)
      sprite.anchor.set(0.5, 0.5);
      sprite.x = displayWidth / 2;
      sprite.y = displayHeight / 2;
      
      // Implement object-fit: cover behavior to prevent stretching (same as slider)
      const containerAspect = displayWidth / displayHeight;
      const textureAspect = texture.width / texture.height;
      
      if (textureAspect > containerAspect) {
        // Texture is wider, scale by height and crop sides
        sprite.height = displayHeight;
        sprite.width = displayHeight * textureAspect;
      } else {
        // Texture is taller, scale by width and crop top/bottom
        sprite.width = displayWidth;
        sprite.height = displayWidth / textureAspect;
      }
      
      // Create a mask to crop the sprite to the container bounds (same as slider)
      const mask = new PIXI.Graphics();
      mask.rect(-displayWidth/2, -displayHeight/2, displayWidth, displayHeight);
      mask.fill(0xffffff);
      mask.x = displayWidth / 2;
      mask.y = displayHeight / 2;
      sprite.mask = mask;
      this.app.stage.addChild(mask);
      
      // Store sprite reference
      this.sprite = sprite;
      
      // Make sprite interactive for hover effects
      sprite.eventMode = 'static';
      sprite.interactive = true;
      sprite.cursor = 'pointer';
      
      // Add to stage
      this.app.stage.addChild(sprite);

      // Position canvas exactly like CSS positions hero image
      this.app.canvas.style.position = 'absolute';
      this.app.canvas.style.left = '50%';
      this.app.canvas.style.top = '50%';
      this.app.canvas.style.transform = 'translate(-50%, -50%)';
      this.app.canvas.style.width = displayWidth + 'px';
      this.app.canvas.style.height = displayHeight + 'px';
      this.app.canvas.style.pointerEvents = 'none';
      this.app.canvas.style.zIndex = '2';

      // DON'T modify hero image positioning at all - CSS handles it perfectly

      // Add canvas and make it ready
      heroImage.parentNode.insertBefore(this.app.canvas, heroImage.nextSibling);
      
      // Make canvas visible and hide hero image immediately - no flicker because they're in exact same position
      this.app.canvas.style.opacity = '1';
      heroImage.style.opacity = '0';

      // Setup gallery interaction immediately after PIXI is ready
      this.setupSpriteInteraction();

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

  async setupGallery(heroImage) {
    // Get project number from current page URL to determine which gallery to load
    const projectNumber = this.getProjectNumber();
    
    // Define gallery images per project - simple HTML img src switching
    const basePath = window.location.hostname === 'localhost' ? './img/project/' : '/portfolio_clean/img/project/';
    const projectGalleries = {
      1: [
        basePath + '51793e_4a8ef5a46faa413c808664a56e668ffc~mv2 1.png',
        basePath + 'Screenshot 2025-06-16 at 16.24.51 1.png',
        basePath + 'Screenshot 2025-06-17 at 00.03.55 1.png'
      ],
      2: [
        basePath + 'Screenshot 2025-06-17 at 00.14.29 1.png',
        basePath + 'Screenshot 2025-06-17 at 00.14.52 1.png',
        basePath + 'Screenshot 2025-06-17 at 00.15.56 1.png'
      ],
      3: [
        basePath + 'Screenshot 2025-06-17 at 00.16.31 1.png',
        basePath + 'Screenshot 2025-06-17 at 00.16.56 1.png',
        basePath + 'Screenshot 2025-06-17 at 00.52.22 1.png'
      ],
      // Default fallback for other projects
      default: [
        basePath + '51793e_4a8ef5a46faa413c808664a56e668ffc~mv2 1.png',
        basePath + 'Screenshot 2025-06-16 at 16.24.51 1.png',
        basePath + 'Screenshot 2025-06-17 at 00.03.55 1.png'
      ]
    };

    // Get gallery for current project
    this.galleryImages = projectGalleries[projectNumber] || projectGalleries.default;
    this.currentImageIndex = 0;
    
    // Gallery will be enabled after scale animation completes
    this.galleryEnabled = false;
  }

  getProjectNumber() {
    // Extract project number from URL (project-1.html -> 1)
    const path = window.location.pathname;
    const match = path.match(/project-(\d+)\.html/);
    return match ? parseInt(match[1]) : 1;
  }

  setupSpriteInteraction() {
    // Add multiple interaction handlers to HTML hero image
    if (this.heroImage) {
      this.heroImage.style.cursor = 'pointer';
      
      // Click handler
      this.heroImage.addEventListener('click', (e) => {
        e.preventDefault();
        this.nextImage();
      });
      
      // Swipe handlers
      this.setupSwipeHandlers();
      
      // Scroll handler
      this.setupScrollHandler();
      
      // Keyboard handlers
      this.setupKeyboardHandlers();
    }
  }

  setupSwipeHandlers() {
    let startX = 0;
    let startY = 0;
    
    this.heroImage.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });
    
    this.heroImage.addEventListener('touchend', (e) => {
      if (!this.galleryEnabled) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = startX - endX;
      const diffY = startY - endY;
      
      // Check if horizontal swipe is dominant
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        e.preventDefault();
        if (diffX > 0) {
          // Swipe left - next image
          this.nextImage();
        } else {
          // Swipe right - previous image
          this.previousImage();
        }
      }
    });
  }

  setupScrollHandler() {
    // Add scroll handler to entire document for project pages
    this.scrollHandler = (e) => {
      if (!this.galleryEnabled) return;
      
      e.preventDefault();
      
      if (e.deltaY > 0) {
        // Scroll down - next image
        this.nextImage();
      } else {
        // Scroll up - previous image
        this.previousImage();
      }
    };
    
    document.addEventListener('wheel', this.scrollHandler, { passive: false });
  }

  setupKeyboardHandlers() {
    // Add keyboard navigation when image is focused/active
    document.addEventListener('keydown', (e) => {
      if (!this.galleryEnabled) return;
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.previousImage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextImage();
          break;
      }
    });
  }

  enableGallery() {
    // Called after scale animation completes
    this.galleryEnabled = true;
    this.createImageCounter();
    this.createNavigationArrows();
    this.updateImageCounter();
    
    // Show counter if it was hidden
    if (this.imageCounter) {
      this.imageCounter.style.display = 'block';
    }
    
    // Show click areas if they were hidden
    if (this.leftClickArea) {
      this.leftClickArea.style.display = 'flex';
    }
    if (this.rightClickArea) {
      this.rightClickArea.style.display = 'flex';
    }
  }

  createImageCounter() {
    // Create counter element in UI top center
    if (!this.imageCounter) {
      this.imageCounter = document.createElement('div');
      this.imageCounter.className = 'gallery-counter';
      this.imageCounter.style.cssText = `
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(0, 0, 0, 0.8);
        font-size: 18px;
        padding: 0.5em 1em;
        pointer-events: none;
        z-index: 20;
      `;
      
      // Add to UI overlay
      const uiOverlay = document.querySelector('.ui-overlay');
      if (uiOverlay) {
        uiOverlay.appendChild(this.imageCounter);
      }
    }
  }

  updateImageCounter() {
    if (this.imageCounter && this.galleryImages) {
      this.imageCounter.textContent = `${this.currentImageIndex + 1}/${this.galleryImages.length}`;
    }
  }

  createNavigationArrows() {
    // Create left click area (previous)
    if (!this.leftClickArea) {
      this.leftClickArea = document.createElement('div');
      this.leftClickArea.className = 'gallery-click-area gallery-click-left';
      this.leftClickArea.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: 50%;
        height: 100vh;
        background: transparent;
        cursor: pointer;
        user-select: none;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding-left: 2em;
      `;
      
      // Create arrow inside click area
      const leftArrow = document.createElement('div');
      leftArrow.innerHTML = '←';
      leftArrow.style.cssText = `
        font-size: 24px;
        color: rgba(0, 0, 0, 0.6);
        transition: color 0.2s ease;
        pointer-events: none;
      `;
      
      this.leftClickArea.appendChild(leftArrow);
      this.leftArrow = leftArrow; // Keep reference for styling
      
      this.leftClickArea.addEventListener('click', (e) => {
        e.preventDefault();
        this.previousImage();
      });
      
      this.leftClickArea.addEventListener('mouseenter', () => {
        this.leftArrow.style.color = 'rgba(0, 0, 0, 1)';
      });
      
      this.leftClickArea.addEventListener('mouseleave', () => {
        this.leftArrow.style.color = 'rgba(0, 0, 0, 0.6)';
      });
      
      document.body.appendChild(this.leftClickArea);
    }

    // Create right click area (next)
    if (!this.rightClickArea) {
      this.rightClickArea = document.createElement('div');
      this.rightClickArea.className = 'gallery-click-area gallery-click-right';
      this.rightClickArea.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        width: 50%;
        height: 100vh;
        background: transparent;
        cursor: pointer;
        user-select: none;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 2em;
      `;
      
      // Create arrow inside click area
      const rightArrow = document.createElement('div');
      rightArrow.innerHTML = '→';
      rightArrow.style.cssText = `
        font-size: 24px;
        color: rgba(0, 0, 0, 0.6);
        transition: color 0.2s ease;
        pointer-events: none;
      `;
      
      this.rightClickArea.appendChild(rightArrow);
      this.rightArrow = rightArrow; // Keep reference for styling
      
      this.rightClickArea.addEventListener('click', (e) => {
        e.preventDefault();
        this.nextImage();
      });
      
      this.rightClickArea.addEventListener('mouseenter', () => {
        this.rightArrow.style.color = 'rgba(0, 0, 0, 1)';
      });
      
      this.rightClickArea.addEventListener('mouseleave', () => {
        this.rightArrow.style.color = 'rgba(0, 0, 0, 0.6)';
      });
      
      document.body.appendChild(this.rightClickArea);
    }
  }

  disableGallery() {
    // Disable gallery during transitions
    this.galleryEnabled = false;
    
    // Hide counter during transitions
    if (this.imageCounter) {
      this.imageCounter.style.display = 'none';
    }
    
    // Hide click areas during transitions
    if (this.leftClickArea) {
      this.leftClickArea.style.display = 'none';
    }
    if (this.rightClickArea) {
      this.rightClickArea.style.display = 'none';
    }
  }

  async nextImage() {
    if (this.isTransitioning || !this.galleryEnabled || !this.galleryImages.length) return;

    this.isTransitioning = true;
    
    // Move to next image (cycle back to 0 when at end)
    this.currentImageIndex = (this.currentImageIndex + 1) % this.galleryImages.length;
    
    this.changeImage();
  }

  async previousImage() {
    if (this.isTransitioning || !this.galleryEnabled || !this.galleryImages.length) return;

    this.isTransitioning = true;
    
    // Move to previous image (cycle to end when at 0)
    this.currentImageIndex = this.currentImageIndex === 0 ? 
      this.galleryImages.length - 1 : 
      this.currentImageIndex - 1;
    
    this.changeImage();
  }

  changeImage() {
    // Simple fade transition on HTML img
    gsap.to(this.heroImage, {
      opacity: 0.3,
      duration: 0.2,
      onComplete: () => {
        // Change HTML img src
        this.heroImage.src = this.galleryImages[this.currentImageIndex];
        
        // Update counter
        this.updateImageCounter();
        
        // Fade back in
        gsap.to(this.heroImage, {
          opacity: 1,
          duration: 0.2,
          onComplete: () => {
            this.isTransitioning = false;
          }
        });
      }
    });
  }

  destroy() {
    try {
      // Remove image counter
      if (this.imageCounter && this.imageCounter.parentNode) {
        this.imageCounter.parentNode.removeChild(this.imageCounter);
        this.imageCounter = null;
      }
      
      // Remove navigation click areas
      if (this.leftClickArea && this.leftClickArea.parentNode) {
        this.leftClickArea.parentNode.removeChild(this.leftClickArea);
        this.leftClickArea = null;
        this.leftArrow = null;
      }
      if (this.rightClickArea && this.rightClickArea.parentNode) {
        this.rightClickArea.parentNode.removeChild(this.rightClickArea);
        this.rightClickArea = null;
        this.rightArrow = null;
      }
      
      // Remove scroll handler from document
      if (this.scrollHandler) {
        document.removeEventListener('wheel', this.scrollHandler);
        this.scrollHandler = null;
      }
      
      // Remove click handler from hero image
      if (this.heroImage) {
        this.heroImage.style.cursor = '';
        this.heroImage.removeEventListener('click', this.nextImage);
      }

      // Remove canvas from DOM
      if (this.app && this.app.canvas && this.app.canvas.parentNode) {
        this.app.canvas.parentNode.removeChild(this.app.canvas);
      }

      // Properly unload the hero image texture
      if (this.heroImage && this.heroImage.src) {
        try {
          PIXI.Assets.unload(this.heroImage.src);
        } catch (error) {
          console.warn('Error unloading hero image texture:', error);
        }
      }

      if (this.app) {
        this.app.destroy(true, { children: true, texture: false }); // Don't destroy textures here
        this.app = null;
      }

      // Keep hero image visible
      if (this.heroImage) {
        this.heroImage.style.opacity = '1';
        this.heroImage = null;
      }

      this.displacementSprite = null;
      this.displacementFilter = null;
      this.sprite = null;
      this.galleryImages = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to destroy project hero effect:', error);
    }
  }
}

//! ========================================
//! 8. INITIALISATIE & CLEANUP FUNCTIES
//! ========================================

// Initialize slider only on home page
let slider = null;
let projectHeroEffect = null;
let ticker = null;

function initSlider() {
  const sliderEl = document.querySelector('.js-slider');
  if (sliderEl && !slider) {
    slider = new SimplePixiSlider(sliderEl);
    ticker = () => slider.render();
    gsap.ticker.add(ticker);
  }
}

async function initSliderWithIntro() {
  // Create white loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: white;
    z-index: 10000;
    pointer-events: none;
  `;
  document.body.appendChild(loadingOverlay);
  
  // Initialize slider
  const sliderEl = document.querySelector('.js-slider');
  if (sliderEl && !slider) {
    slider = new SimplePixiSlider(sliderEl);
    ticker = () => slider.render();
    gsap.ticker.add(ticker);
    
    // Wait for slider to be ready
    await new Promise(resolve => {
      const checkReady = () => {
        if (slider && slider.items && slider.items.length > 0) {
          resolve();
        } else {
          requestAnimationFrame(checkReady);
        }
      };
      checkReady();
    });
    
    // Calculate proper intro distance - multiple loops for dramatic effect
    const isVertical = store.isDevice;
    const containerSize = isVertical ? slider.getContainerHeight() : slider.getContainerWidth();
    const introDistance = containerSize * 2.5; // Start much further back for multiple loops
    
    // Set initial positions - current starts at intro distance, target will be animated
    slider.state.current = -introDistance;
    slider.state.target = -introDistance; // Start both at same position
    
    // Start intro timeline
    const introTl = gsap.timeline();
    
    // Store reference to target animation for interruption
    const targetAnimation = gsap.to(slider.state, {
      target: 0, // Only animate target, not current
      duration: 2.5, // 2.5 seconds duration
      ease: "power4.out", // More extreme easing - very fast start, very slow end
    });
    
    // Add target animation to timeline
    introTl.add(targetAnimation, 0);
    
    // Fade out loading overlay after 0.3 seconds
    introTl.to(loadingOverlay, {
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => {
        loadingOverlay.remove();
      }
    }, 0.3);
    
    // Add opacity fade-in for slider
    const domGl = document.querySelector('.dom-gl');
    if (domGl) {
      domGl.style.opacity = '0';
      introTl.to(domGl, {
        opacity: 1,
        duration: 1,
        ease: "power2.out"
      }, 0.3);
    }
    
    // Store animation reference for interruption
    slider.introAnimation = targetAnimation;
  }
}

async function initProjectHeroEffect() {
  // Always destroy existing instance first to ensure clean state
  if (projectHeroEffect) {
    projectHeroEffect.destroy();
    projectHeroEffect = null;
  }
  
  // Create fresh instance
  projectHeroEffect = new ProjectHeroEffect();
  
  const success = await projectHeroEffect.init();
  
  if (success) {
    // Make sure global reference is set
    window.projectHeroEffect = projectHeroEffect;
  }
}

async function destroySlider() {
  if (slider) {
    if (ticker) gsap.ticker.remove(ticker);
    await slider.destroy();
    slider = null;
    ticker = null;
  }
}

async function destroyProjectHeroEffect() {
  if (projectHeroEffect) {
    projectHeroEffect.destroy();
    projectHeroEffect = null;
  }
}

//! ========================================
//! 7. BARBA.JS PAGE TRANSITIONS
//! ========================================

// Initialize Barba.js
barba.init({
  transitions: [{
    name: 'project-transition',
    from: {
      namespace: 'home'
    },
    to: {
      namespace: 'project'
    },
    async beforeEnter(data) {
      // Hide the new page BEFORE it becomes visible
      data.next.container.style.opacity = '0';
      
      // Preload hero image to prevent flicker
      const heroImg = data.next.container.querySelector('.project-hero-image');
      if (heroImg && heroImg.src) {
        const img = new Image();
        img.src = heroImg.src;
        await img.decode().catch(() => {}); // Wait for image to load
      }
      
      // Initialize project hero effect BEFORE page becomes visible
      await initProjectHeroEffect();
    },
    leave(data) {
      // Disable gallery during transition to prevent PIXI conflicts
      if (window.projectHeroEffect) {
        window.projectHeroEffect.disableGallery();
      }
      
      // Disable wheel events to prevent scroll blocking
      if (slider && !store.isDevice) {
        window.removeEventListener('wheel', slider.onWheel);
      }
      
      // Hide UI instantly
      const uiOverlay = data.current.container.querySelector('.ui-overlay');
      const sliderHTML = data.current.container.querySelector('.slider');
      
      if (uiOverlay) uiOverlay.style.opacity = '0';
      if (sliderHTML) sliderHTML.style.opacity = '0';
      
      // Show transition image if it exists
      if (window.transitionImage) {
        window.transitionImage.style.opacity = '1';
        window.transitionImage.style.zIndex = '9999';
      }
      
      // Hide canvas instantly
      const canvas = document.querySelector('canvas');
      if (canvas) canvas.style.opacity = '0';
      
      return gsap.timeline(); // Empty timeline - no animations
    },
    enter(data) {
      // Disable scrolling for fixed project layout
      document.body.style.overflow = 'hidden';
      
      // Get elements
      const heroImg = data.next.container.querySelector('.project-hero-image');
      
      // CRUCIAL: Position hero image EXACTLY where transition image is
      if (heroImg && window.transitionImage) {
        // Get transition image position
        const rect = window.transitionImage.getBoundingClientRect();
        
        // Apply exact position to hero image
        heroImg.style.position = 'fixed';
        heroImg.style.left = rect.left + 'px';
        heroImg.style.top = rect.top + 'px';
        heroImg.style.width = rect.width + 'px';
        heroImg.style.height = rect.height + 'px';
        heroImg.style.zIndex = '10000'; // Above transition image
        heroImg.style.opacity = '1';
        heroImg.style.transform = 'none';
        heroImg.style.transition = 'none';
        
        // Force layout
        heroImg.offsetHeight;
        
        // Now remove transition image
        window.transitionImage.remove();
        window.transitionImage = null;
        
        // Show the page
        data.next.container.style.opacity = '1';
        
        // Reset hero to normal position instantly
        heroImg.style.position = '';
        heroImg.style.left = '';
        heroImg.style.top = '';
        heroImg.style.width = '';
        heroImg.style.height = '';
        heroImg.style.zIndex = '';
        heroImg.style.transform = '';
        
        // Start scale animation after position reset
        setTimeout(() => {
          gsap.to(heroImg, {
            scale: 1.5,
            duration: 1.8,
            ease: "power2.out",
            transformOrigin: "center center",
            onComplete: () => {
              // Add extra delay to ensure PIXI errors are finished
              setTimeout(() => {
                if (projectHeroEffect) {
                  projectHeroEffect.enableGallery();
                }
              }, 500); // Wait for PIXI to stabilize
            }
          });
        }, 100); // Small delay to ensure position is reset
      } else {
        // Fallback if no transition image
        if (heroImg) {
          heroImg.style.opacity = '1';
          heroImg.style.transform = 'scale(1)';
          
          // Start scale animation for fallback case too
          setTimeout(() => {
            gsap.to(heroImg, {
              scale: 1.5,
              duration: 1.8,
              ease: "power2.out",
              transformOrigin: "center center",
              onComplete: () => {
                // Add extra delay to ensure PIXI errors are finished
                setTimeout(() => {
                  if (projectHeroEffect) {
                    projectHeroEffect.enableGallery();
                  }
                }, 500); // Wait for PIXI to stabilize
              }
            });
          }, 100);
        }
        data.next.container.style.opacity = '1';
      }
      
      return gsap.timeline(); // Empty timeline - no animations
    },
    async afterEnter() {
      // KEEP SCROLLING DISABLED on project page for fixed layout
      document.body.style.overflow = 'hidden';
      
      // Clean up PIXI canvas from slider
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.remove();
      }
      
      // Clean up global state
      window.finalSpritePosition = null;
      
      // Destroy slider for memory cleanup
      await destroySlider().catch(console.warn);
    },
    beforeLeave() {
      // Disable scrolling when leaving home
      document.body.style.overflow = 'hidden';
    }
  }, {
    name: 'project-to-home',
    from: {
      namespace: 'project'
    },
    to: {
      namespace: 'home'
    },
    leave(data) {
      // Disable gallery during transition to prevent PIXI conflicts
      if (window.projectHeroEffect) {
        window.projectHeroEffect.disableGallery();
      }
      
      // Clean up transition image
      if (window.transitionImage) {
        window.transitionImage.remove();
        window.transitionImage = null;
      }
      
      // Hide project page instantly
      data.current.container.style.opacity = '0';
      return gsap.timeline(); // No animations
    },
    async enter(data) {
      // Set scrolling for home page
      document.body.style.overflow = 'hidden';
      
      // Show home page instantly
      data.next.container.style.opacity = '1';
      
      // Destroy project hero effect
      await destroyProjectHeroEffect();
      
      // Initialize slider with intro animation
      initSliderWithIntro();
      
      return gsap.timeline(); // No animations
    }
  }]
});

//! ========================================
//! 8. PAGE DETECTION & INITIALISATIE
//! ========================================

// Initialize on first load based on current page
const currentNamespace = document.querySelector('[data-barba-namespace]')?.getAttribute('data-barba-namespace');

if (currentNamespace === 'home') {
  // Initialize slider with intro animation
  initSliderWithIntro();
  document.body.style.overflow = 'hidden';
} else if (currentNamespace === 'project') {
  // Initialize project hero effect
  initProjectHeroEffect();
  document.body.style.overflow = 'hidden'; // Fixed layout - no scrolling
  
  // Add scale animation for direct page load (not from transition)
  setTimeout(() => {
    const heroImg = document.querySelector('.project-hero-image');
    if (heroImg) {
      gsap.to(heroImg, {
        scale: 1.5,
        duration: 1.8,
        ease: "power2.out",
        transformOrigin: "center center",
        onComplete: () => {
          // Add extra delay to ensure PIXI errors are finished
          setTimeout(() => {
            if (projectHeroEffect) {
              projectHeroEffect.enableGallery();
            }
          }, 500); // Wait for PIXI to stabilize
        }
      });
    }
  }, 500); // Longer delay for direct page load
}

//! ========================================
//! GLOBAL BARBA HOOKS VOOR SCROLL & INTERACTIE MANAGEMENT
//! ========================================

// Global Barba.js hooks for scroll management and interaction control
barba.hooks.enter((data) => {
  // Only reset scroll position for home page, not project pages
  const namespace = data.next.namespace;
  if (namespace === 'home') {
    window.scrollTo(0, 0);
  }
  // Project pages keep their scroll position for immediate scrolling
});

barba.hooks.before(() => {
  // Disable pointer events during transitions
  document.querySelector('html').classList.add('is-transitioning');
});

barba.hooks.after(() => {
  // Re-enable interaction after transitions
  document.querySelector('html').classList.remove('is-transitioning');
});