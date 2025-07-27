import * as PIXI from 'pixi.js';
import { CONFIG, store } from './config.js';

export class PixiRenderer {
  constructor() {
    this.app = null;
    this.container = null;
    this.geometry = null;
    this.uniforms = null;
    this.items = [];
    this.isInitialized = false;
  }

  async init() {
    try {
      // Create PIXI application
      this.app = new PIXI.Application();
      await this.app.init({
        width: store.ww,
        height: store.wh,
        backgroundColor: CONFIG.PIXI.BACKGROUND,
        antialias: CONFIG.PIXI.ANTIALIAS,
        resolution: CONFIG.PIXI.RESOLUTION
      });

      // Append canvas to DOM
      const domGL = document.querySelector('.dom-gl');
      if (!domGL) {
        throw new Error('DOM element .dom-gl not found');
      }
      domGL.appendChild(this.app.canvas);

      // Create main container
      this.container = new PIXI.Container();
      this.app.stage.addChild(this.container);

      // Setup geometry and uniforms
      this.setupGeometry();
      this.setupUniforms();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize PIXI renderer:', error);
      return false;
    }
  }

  setupGeometry() {
    try {
      this.geometry = new PIXI.Geometry();
      this.geometry.addAttribute('aVertexPosition', [
        -1, -1,
        1, -1,
        1, 1,
        -1, 1
      ], 2);
      this.geometry.addAttribute('aUvs', [
        0, 1,
        1, 1,
        1, 0,
        0, 0
      ], 2);
      this.geometry.addIndex([0, 1, 2, 0, 2, 3]);
    } catch (error) {
      console.error('Failed to setup geometry:', error);
      throw error;
    }
  }

  setupUniforms() {
    try {
      this.uniforms = {
        uTime: 0,
        uSpeed: CONFIG.SLIDER.UNIFORM_SPEED,
        uVelocity: 0,
        uDirection: 0
      };
    } catch (error) {
      console.error('Failed to setup uniforms:', error);
      throw error;
    }
  }

  async createTextureFromImage(img) {
    try {
      if (!img.complete) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 5000);

          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image failed to load'));
          };
        });
      }

      const texture = PIXI.Texture.from(img);
      return texture;
    } catch (error) {
      console.error('Failed to create texture from image:', error);
      throw error;
    }
  }

  createMesh(texture, width, height) {
    try {
      if (!this.geometry || !this.uniforms) {
        throw new Error('Geometry or uniforms not initialized');
      }

      const vertexShader = `
        attribute vec2 aVertexPosition;
        attribute vec2 aUvs;
        uniform mat3 translationMatrix;
        uniform mat3 projectionMatrix;
        varying vec2 vUvs;
        
        void main() {
          vUvs = aUvs;
          gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
        }
      `;

      const fragmentShader = `
        precision mediump float;
        varying vec2 vUvs;
        uniform sampler2D uSampler;
        uniform float uTime;
        uniform float uSpeed;
        uniform float uVelocity;
        uniform float uDirection;
        
        void main() {
          vec2 uv = vUvs;
          vec4 color = texture2D(uSampler, uv);
          gl_FragColor = color;
        }
      `;

      const shader = PIXI.Shader.from(vertexShader, fragmentShader, {
        ...this.uniforms,
        uSampler: texture
      });

      const mesh = new PIXI.Mesh(this.geometry, shader);
      mesh.width = width;
      mesh.height = height;

      return mesh;
    } catch (error) {
      console.error('Failed to create mesh:', error);
      throw error;
    }
  }

  addItem(mesh, x, y) {
    try {
      if (!this.container) {
        throw new Error('Container not initialized');
      }

      mesh.x = x;
      mesh.y = y;
      this.container.addChild(mesh);
      this.items.push(mesh);

      return mesh;
    } catch (error) {
      console.error('Failed to add item:', error);
      throw error;
    }
  }

  updateUniforms(time, velocity, direction) {
    try {
      if (!this.uniforms) return;

      this.uniforms.uTime = time;
      this.uniforms.uVelocity = velocity;
      this.uniforms.uDirection = direction;

      // Update all mesh uniforms
      this.items.forEach(item => {
        if (item.shader && item.shader.uniforms) {
          Object.assign(item.shader.uniforms, this.uniforms);
        }
      });
    } catch (error) {
      console.error('Failed to update uniforms:', error);
    }
  }

  resize(width, height) {
    try {
      if (!this.app) return;

      this.app.renderer.resize(width, height);
      store.ww = width;
      store.wh = height;
    } catch (error) {
      console.error('Failed to resize renderer:', error);
    }
  }

  destroy() {
    try {
      if (this.items) {
        this.items.forEach(item => {
          if (item.parent) {
            item.parent.removeChild(item);
          }
          if (item.destroy) {
            item.destroy();
          }
        });
        this.items = [];
      }

      if (this.container) {
        this.container.destroy({ children: true });
        this.container = null;
      }

      if (this.app) {
        this.app.destroy(true, { children: true, texture: true });
        this.app = null;
      }

      this.geometry = null;
      this.uniforms = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to destroy renderer:', error);
    }
  }
}