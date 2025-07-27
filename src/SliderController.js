import { CONFIG, store } from './config.js';

export class SliderController {
  constructor(renderer) {
    this.renderer = renderer;
    this.el = null;
    this.opts = {};
    
    this.ui = {
      items: null,
      projectItems: null,
      projectTitle: null,
      projectDetails: null,
      projectDescription: null
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
    this.projectData = [];
  }

  init(el, opts = {}) {
    try {
      this.el = el;
      this.opts = Object.assign({
        speed: store.isDevice ? CONFIG.SLIDER.SPEED.MOBILE : CONFIG.SLIDER.SPEED.DESKTOP,
        ease: store.isDevice ? CONFIG.SLIDER.EASE.MOBILE : CONFIG.SLIDER.EASE.DESKTOP
      }, opts);

      this.setupUI();
      this.setupProjectData();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize slider controller:', error);
      return false;
    }
  }

  setupUI() {
    try {
      if (!this.el) {
        throw new Error('Slider element not provided');
      }

      this.ui.items = this.el.querySelectorAll(CONFIG.SELECTORS.SLIDE);
      this.ui.projectItems = document.querySelectorAll(CONFIG.SELECTORS.PROJECT_ITEM);
      this.ui.projectTitle = document.querySelector(CONFIG.SELECTORS.PROJECT_TITLE);
      this.ui.projectDetails = document.querySelector(CONFIG.SELECTORS.PROJECT_DETAILS);
      this.ui.projectDescription = document.querySelector(CONFIG.SELECTORS.PROJECT_DESCRIPTION);

      if (!this.ui.items.length) {
        throw new Error('No slider items found');
      }
    } catch (error) {
      console.error('Failed to setup UI:', error);
      throw error;
    }
  }

  setupProjectData() {
    try {
      this.projectData = [
        {
          title: "Creative Vision Project",
          details: "A comprehensive exploration of digital artistry and innovative design solutions.",
          description: "This project represents a deep dive into creative possibilities, showcasing the intersection of technology and artistic expression."
        },
        {
          title: "Design System Evolution",
          details: "Modernizing user interfaces through systematic design approaches and user-centered methodologies.",
          description: "An extensive project focusing on creating cohesive design languages and scalable interface solutions."
        },
        {
          title: "Interactive Experience",
          details: "Crafting immersive digital experiences that engage users through innovative interaction patterns.",
          description: "This work explores the boundaries of user interaction, creating memorable and intuitive digital experiences."
        },
        {
          title: "Brand Identity Refresh",
          details: "Revitalizing brand presence through strategic visual communication and contemporary design principles.",
          description: "A complete brand transformation project, establishing strong visual identity and market presence."
        },
        {
          title: "Motion Graphics Study",
          details: "Exploring dynamic visual storytelling through advanced animation techniques and motion design.",
          description: "A comprehensive study of motion graphics, pushing the boundaries of animated visual communication."
        },
        {
          title: "Digital Art Installation",
          details: "Blending traditional artistry with cutting-edge technology to create immersive digital environments.",
          description: "An ambitious project merging physical and digital spaces through innovative artistic expression."
        },
        {
          title: "User Experience Research",
          details: "Comprehensive user research and testing to optimize digital product experiences and usability.",
          description: "In-depth research project focusing on understanding user behavior and improving digital interactions."
        }
      ];
    } catch (error) {
      console.error('Failed to setup project data:', error);
      throw error;
    }
  }

  async loadItems() {
    try {
      if (!this.ui.items.length || !this.renderer.isInitialized) {
        throw new Error('Items or renderer not ready');
      }

      const itemSize = store.isDevice ? CONFIG.LAYOUT.ITEM_WIDTH_MOBILE_VW : CONFIG.LAYOUT.ITEM_WIDTH_VW;
      const size = store.ww * (itemSize / 100);

      for (let i = 0; i < this.ui.items.length; i++) {
        const item = this.ui.items[i];
        const img = item.querySelector(CONFIG.SELECTORS.SLIDE_IMG);
        
        if (!img) {
          console.warn(`No image found for item ${i}`);
          continue;
        }

        try {
          const texture = await this.renderer.createTextureFromImage(img);
          const mesh = this.renderer.createMesh(texture, size, size);
          
          const x = (store.ww / 2) - (size / 2);
          const y = (store.wh / 2) - (size / 2);
          
          this.renderer.addItem(mesh, x, y);
          
          this.items.push({
            el: item,
            img,
            mesh,
            extra: 0,
            currentX: 0
          });
        } catch (itemError) {
          console.error(`Failed to load item ${i}:`, itemError);
        }
      }

      console.log(`Loaded ${this.items.length} items successfully`);
      return this.items.length > 0;
    } catch (error) {
      console.error('Failed to load items:', error);
      return false;
    }
  }

  updateItemPositions() {
    try {
      if (!this.items.length) return;

      const { ww } = store;
      const { target, current } = this.state;
      const itemsLength = this.items.length;
      
      this.items.forEach((item, index) => {
        const itemSize = item.mesh.width;
        const wrapper = CONFIG.SLIDER.WRAPPER_SIZE;
        const itemsSize = CONFIG.SLIDER.ITEM_SIZE;
        
        let x = ((index * itemsSize) - (current % (itemsLength * itemsSize))) / wrapper * ww;
        
        // Apply wrapping logic
        if (x < -itemSize) {
          x += itemsLength * itemsSize / wrapper * ww;
          item.extra += itemsLength * itemsSize / wrapper * ww;
        }
        if (x > ww) {
          x -= itemsLength * itemsSize / wrapper * ww;
          item.extra -= itemsLength * itemsSize / wrapper * ww;
        }
        
        item.currentX = x;
        item.mesh.x = x;
      });
    } catch (error) {
      console.error('Failed to update item positions:', error);
    }
  }

  updateProgress() {
    try {
      const progress = Math.abs(this.state.current) / (this.items.length * CONFIG.SLIDER.ITEM_SIZE);
      const progressElements = document.querySelectorAll('.progress__line');
      
      progressElements.forEach(line => {
        if (line.style) {
          line.style.transform = `scaleX(${progress % 1})`;
        }
      });
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }

  updateProjectInfo(index) {
    try {
      if (!this.projectData[index] || !this.ui.projectTitle || !this.ui.projectDetails) {
        return;
      }

      const project = this.projectData[index];
      this.ui.projectTitle.textContent = project.title;
      this.ui.projectDetails.textContent = project.details;
    } catch (error) {
      console.error('Failed to update project info:', error);
    }
  }

  getCurrentIndex() {
    try {
      const itemsLength = this.items.length;
      if (itemsLength === 0) return 0;

      return Math.round(Math.abs(this.state.current) / CONFIG.SLIDER.ITEM_SIZE) % itemsLength;
    } catch (error) {
      console.error('Failed to get current index:', error);
      return 0;
    }
  }

  navigateToProject(index) {
    try {
      if (index < 0 || index >= this.items.length) {
        throw new Error(`Invalid project index: ${index}`);
      }

      const targetPosition = -(index * CONFIG.SLIDER.ITEM_SIZE);
      this.state.target = targetPosition;
      
      this.updateProjectInfo(index);
      
      // Clear previous highlights
      this.ui.projectItems.forEach(item => {
        item.classList.remove('highlighted', 'selected');
      });
      
      // Highlight current project
      if (this.ui.projectItems[index]) {
        this.ui.projectItems[index].classList.add('highlighted');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to navigate to project:', error);
      return false;
    }
  }

  resize() {
    try {
      const itemSize = store.isDevice ? CONFIG.LAYOUT.ITEM_WIDTH_MOBILE_VW : CONFIG.LAYOUT.ITEM_WIDTH_VW;
      const size = store.ww * (itemSize / 100);

      this.items.forEach(item => {
        if (item.mesh) {
          item.mesh.width = size;
          item.mesh.height = size;
        }
      });

      this.updateItemPositions();
    } catch (error) {
      console.error('Failed to resize slider:', error);
    }
  }

  destroy() {
    try {
      // Clear timeouts
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
      }
      
      if (this.fadeTimeout) {
        clearTimeout(this.fadeTimeout);
        this.fadeTimeout = null;
      }

      // Reset state
      this.state = {
        target: 0,
        current: 0,
        direction: 0,
        on: { x: 0, y: 0 },
        off: 0,
        flags: { dragging: false }
      };

      this.items = [];
      this.projectData = [];
      this.expandedIndex = null;
      this.isAnimating = false;
    } catch (error) {
      console.error('Failed to destroy slider controller:', error);
    }
  }
}