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
      speed: 2,
      ease: 0.075
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
    // Create PIXI application
    this.app = new PIXI.Application();
    await this.app.init({
      width: store.ww,
      height: store.wh,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    // Add canvas to DOM
    this.app.canvas.style.position = 'fixed';
    this.app.canvas.style.top = '0';
    this.app.canvas.style.left = '0';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.pointerEvents = 'none';
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
    const imageUrls = [
      './img/project-1.png',
      './img/project-2.png',
      './img/project-3.png',
      './img/project-4.png',
      './img/project-5.png',
      './img/project-6.png',
      './img/project-7.png'
    ];

    const textures = {};
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        const texture = await PIXI.Assets.load(url);
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
    
    // Make it repeat
    this.displacementSprite.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    
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
      
      // Get image source
      const img = el.querySelector('img');
      const texture = this.textures[img.src];
      
      if (texture) {
        // Create sprite
        const sprite = new PIXI.Sprite(texture);
        
        // Position sprite 
        sprite.anchor.set(0.5);
        sprite.x = 0; // Will be set in render
        sprite.y = store.wh / 2;
        sprite.width = width;
        sprite.height = height;
        
        // Make sprite interactive for hover effects
        sprite.interactive = true;
        sprite.cursor = 'pointer';
        
        // Add hover events
        sprite.on('pointerover', () => this.onProjectHover(i));
        sprite.on('pointerout', () => this.onProjectOut(i));
        
        this.container.addChild(sprite);
        
        // Calculate initial position for modulus wrapping
        const initialX = i * (width + 50); // Simple spacing
        
        // Push to cache
        this.items.push({
          el, sprite,
          width, height,
          initialX,
          projectIndex: i
        });
      } else {
        console.warn('No texture found for:', img.src);
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
      const intensity = 8; // More subtle effect
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
    const containerWidth = this.getContainerWidth();

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      
      if (!item || !item.sprite) continue;
      
      // Simple modulus-based positioning like the example
      const baseX = item.initialX + this.state.current;
      const wrappedX = ((baseX % containerWidth) + containerWidth) % containerWidth;
      
      // Center the sprite
      item.sprite.x = wrappedX - (containerWidth / 2) + (store.ww / 2);
    }
  }

  getContainerWidth() {
    // Calculate total width needed for seamless loop
    if (this.items.length === 0) return store.ww;
    return this.items.length * (this.items[0].width + 50);
  }
  
  getPos({ changedTouches, clientX, clientY, target }) {
    const x = changedTouches ? changedTouches[0].clientX : clientX;
    const y = changedTouches ? changedTouches[0].clientY : clientY;
    return { x, y, target };
  }

  onDown(e) {
    const { x, y } = this.getPos(e);
    const { flags, on } = this.state;
    
    flags.dragging = true;
    on.x = x;
    on.y = y;
  }

  onUp() {
    const state = this.state;
    state.flags.dragging = false;
    state.off = state.target;
  }

  onMove(e) {
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

  on() {
    const { move, up, down } = this.events;
    
    window.addEventListener(down, this.onDown);
    window.addEventListener(move, this.onMove);
    window.addEventListener(up, this.onUp);
  }

  off() {
    const { move, up, down } = this.events;
    
    window.removeEventListener(down, this.onDown);
    window.removeEventListener(move, this.onMove);
    window.removeEventListener(up, this.onUp);
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
    
    // Start fade in after 1 second delay
    this.fadeTimeout = setTimeout(() => {
      this.updateProjectDescription(index);
      if (this.ui.projectDescription) {
        this.ui.projectDescription.classList.add('visible');
      }
    }, 1000);
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