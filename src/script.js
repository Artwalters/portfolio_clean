import * as THREE from 'three'
import gsap from 'gsap'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')
canvas.style.cursor = 'grab'

// Scene
const scene = new THREE.Scene()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

/**
 * Event Handlers (bound functions for cleanup)
 */
const eventHandlers = {
    resize: () => {
        sizes.width = window.innerWidth
        sizes.height = window.innerHeight

        camera.aspect = sizes.width / sizes.height
        camera.updateProjectionMatrix()

        renderer.setSize(sizes.width, sizes.height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    },

    wheel: null, // Will be set later
    touchstart: null,
    touchmove: null,
    mousemove: null
}

window.addEventListener('resize', eventHandlers.resize)

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(65, sizes.width / sizes.height, 0.01, 1000)
// Adjust camera position based on device width
const isMobile = window.innerWidth <= 768
const cameraZ = isMobile ? 4 : 3  // Mobile slightly closer, desktop normal
camera.position.z = cameraZ
const baseCameraZ = cameraZ
scene.add(camera)

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x0a0a0a, 1)

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()
const projectImages = []
const imageCount = 9

// Load all project images with proper aspect ratios
const loadPromises = []
for(let i = 1; i <= imageCount; i++) {
    const promise = new Promise((resolve) => {
        const texture = textureLoader.load(
            `./project-${i}.png`,
            (texture) => {
                texture.generateMipmaps = false
                texture.minFilter = THREE.LinearFilter
                texture.magFilter = THREE.LinearFilter
                
                const img = texture.image
                const aspectRatio = img.width / img.height
                
                projectImages.push({
                    texture: texture,
                    aspectRatio: aspectRatio
                })
                resolve()
            }
        )
    })
    loadPromises.push(promise)
}

/**
 * Configuration
 */
const CONFIG = {
    PLANE_HEIGHT: 2,
    PLANE_SPACING: 0.3,
    SETS_NEEDED: 25,
    RESET_BOUNDARY: 6
}

/**
 * Shader Materials
 */
const vertexShader = `
    uniform float uVelo;
    
    varying vec2 vUv;
    
    #define M_PI 3.1415926535897932384626433832795
    
    void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Sine wave distortion based on velocity - creates rubber stretch effect
        pos.x = pos.x + ((sin(uv.y * M_PI) * uVelo) * 1.0);
        
        // Visible but smooth z-depth for 3D effect
        pos.z = sin(uv.y * M_PI) * abs(uVelo) * 0.3;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const fragmentShader = `
    uniform sampler2D uTexture;
    uniform float uVelo;
    
    varying vec2 vUv;
    
    void main() {
        vec2 uv = vUv;
        
        // Simple texture sampling without RGB splitting
        vec4 color = texture2D(uTexture, uv);
        
        gl_FragColor = color;
    }
`;

/**
 * Geometry Cache
 */
const geometryCache = new Map()

function getOrCreateGeometry(width, height) {
    const key = `${width.toFixed(3)}_${height.toFixed(3)}`
    if (!geometryCache.has(key)) {
        // Increase subdivisions for smooth warping
        geometryCache.set(key, new THREE.PlaneGeometry(width, height, 32, 32))
    }
    return geometryCache.get(key)
}

/**
 * Image Planes
 */
const planes = []
let totalWidth = 0
let setsNeeded = 0

Promise.all(loadPromises).then(() => {
    // Calculate total width for all images
    projectImages.forEach((imageData) => {
        const planeWidth = CONFIG.PLANE_HEIGHT * imageData.aspectRatio
        totalWidth += planeWidth + CONFIG.PLANE_SPACING
    })
    
    // Create many sets for infinite scroll
    setsNeeded = CONFIG.SETS_NEEDED
    
    for(let set = 0; set < setsNeeded; set++) {
        let currentX = set * totalWidth - (setsNeeded * totalWidth) / 2 // Center the entire slider
        
        projectImages.forEach((imageData, index) => {
            const planeWidth = CONFIG.PLANE_HEIGHT * imageData.aspectRatio
            const planeGeometry = getOrCreateGeometry(planeWidth, CONFIG.PLANE_HEIGHT)
            
            // Create shader material with uniforms
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    uTexture: { value: imageData.texture },
                    uVelo: { value: 0 }
                },
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                side: THREE.DoubleSide,
                transparent: true
            })
            
            const plane = new THREE.Mesh(planeGeometry, material)
            plane.position.x = currentX + planeWidth / 2
            currentX += planeWidth + CONFIG.PLANE_SPACING
            
            planes.push({
                mesh: plane,
                width: planeWidth,
                projectId: index + 1, // Project 1-9
                material: material // Store material reference for uniform updates
            })
            scene.add(plane)
        })
    }
}).catch(error => {
    console.error('Failed to load textures:', error)
})

/**
 * Scroll Animation
 */
let scrollSpeed = 0
let scrollDirection = 1
let targetScrollDirection = 1
let autoScrollSpeed = 0 // Disabled auto-scroll
let targetScrollSpeed = 0

// Simple variables
let targetCameraZoom = baseCameraZ

// Mouse wheel control
eventHandlers.wheel = (event) => {
    const scrollIntensity = Math.abs(event.deltaY)
    const isMobile = window.innerWidth <= 768
    
    // Simple scroll behavior
    targetScrollDirection = event.deltaY > 0 ? -1 : 1
    
    if (isMobile) {
        // Mobile: faster, more predictable scrolling
        const baseSpeed = scrollIntensity * 0.002
        targetScrollSpeed = Math.min(baseSpeed, 0.08)
    } else {
        // Desktop: much faster scaling
        if (scrollIntensity > 50) {
            const scaledIntensity = Math.pow((scrollIntensity - 50) / 100, 1.2)
            targetScrollSpeed = Math.min(scaledIntensity * 0.025, 0.15)
        } else {
            targetScrollSpeed = Math.min(scrollIntensity * 0.0015, 0.03)
        }
    }
}

window.addEventListener('wheel', eventHandlers.wheel)

// Touch and drag controls
let touchStartX = 0
let isDragging = false
let dragStartX = 0

// Touch events for mobile
eventHandlers.touchstart = (event) => {
    touchStartX = event.touches[0].clientX
}

eventHandlers.touchmove = (event) => {
    const touchX = event.touches[0].clientX
    const deltaX = touchStartX - touchX
    // Set target direction based on swipe direction
    targetScrollDirection = deltaX > 0 ? 1 : -1
    
    // Simpler, smoother touch scrolling for mobile
    const swipeIntensity = Math.abs(deltaX)
    
    // Direct proportional speed - no complex scaling
    const baseSpeed = swipeIntensity * 0.002
    targetScrollSpeed = Math.min(baseSpeed, 0.06)
    
    touchStartX = touchX
}

// Mouse drag events for desktop
eventHandlers.mousedown = (event) => {
    isDragging = true
    dragStartX = event.clientX
    canvas.style.cursor = 'grabbing'
}

eventHandlers.mouseup = () => {
    if (isDragging) {
        isDragging = false
        canvas.style.cursor = 'grab'
    }
}

window.addEventListener('touchstart', eventHandlers.touchstart)
window.addEventListener('touchmove', eventHandlers.touchmove)
window.addEventListener('mousedown', eventHandlers.mousedown)
window.addEventListener('mouseup', eventHandlers.mouseup)

/**
 * Raycaster for hover detection
 */
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hoveredPlane = null
let mouseHasMoved = false
let hoverTimer = null
let pendingHoverProject = null

// Mouse move handler for hover detection and drag
eventHandlers.mousemove = (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1
    mouse.y = -(event.clientY / sizes.height) * 2 + 1
    mouseHasMoved = true
    
    // Handle drag if active
    if (isDragging) {
        const deltaX = dragStartX - event.clientX
        const dragIntensity = Math.abs(deltaX)
        const isMobile = window.innerWidth <= 768
        
        // Smooth drag for all devices
        if (dragIntensity > 2) {
            targetScrollDirection = deltaX > 0 ? 1 : -1
            
            if (isMobile) {
                // Mobile: faster drag
                targetScrollSpeed = Math.min(dragIntensity * 0.003, 0.08)
            } else {
                // Desktop: much faster drag
                targetScrollSpeed = Math.min(dragIntensity * 0.002, 0.1)
            }
        }
        
        dragStartX = event.clientX
    }
}

window.addEventListener('mousemove', eventHandlers.mousemove)

/**
 * Find the project currently in center of screen
 */
function getCurrentCenterProject() {
    let centerPlane = null
    let minDistance = Infinity
    
    planes.forEach(planeData => {
        const distance = Math.abs(planeData.mesh.position.x - 0) // Distance from center (x=0)
        if (distance < minDistance) {
            minDistance = distance
            centerPlane = planeData
        }
    })
    
    return centerPlane ? centerPlane.projectId : 1
}


/**
 * Cleanup function for proper disposal
 */
function cleanup() {
    // Remove all event listeners
    window.removeEventListener('resize', eventHandlers.resize)
    window.removeEventListener('wheel', eventHandlers.wheel)
    window.removeEventListener('touchstart', eventHandlers.touchstart)
    window.removeEventListener('touchmove', eventHandlers.touchmove)
    window.removeEventListener('mousemove', eventHandlers.mousemove)
    window.removeEventListener('mousedown', eventHandlers.mousedown)
    window.removeEventListener('mouseup', eventHandlers.mouseup)
    
    // Clear timers
    if (hoverTimer) {
        clearTimeout(hoverTimer)
        hoverTimer = null
    }
    
    // Dispose geometries
    geometryCache.forEach(geometry => geometry.dispose())
    geometryCache.clear()
    
    // Dispose materials and textures
    planes.forEach(planeData => {
        if (planeData.mesh.material) {
            if (planeData.mesh.material.map) {
                planeData.mesh.material.map.dispose()
            }
            planeData.mesh.material.dispose()
        }
        scene.remove(planeData.mesh)
    })
    
    // Dispose renderer
    renderer.dispose()
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup)

// Function to highlight/unhighlight project text
// Project descriptions
const projectDescriptions = {
    1: "minimalist design exploration focusing on clean typography and spatial relationships",
    2: "interactive installation combining digital media with physical space environments", 
    3: "brand identity system for emerging technology company with comprehensive guidelines",
    4: "editorial design for contemporary art publication emphasizing readability and impact",
    5: "web platform for creative collaboration with intuitive navigation and workflow",
    6: "packaging design series for sustainable products using eco-friendly materials",
    7: "motion graphics campaign for social impact initiative with dynamic storytelling",
    8: "architectural visualization and space planning for modern residential spaces",
    9: "digital art collection exploring generative design and algorithmic creativity"
}

function highlightProject(projectId) {
    try {
        // Clear any existing timer
        if (hoverTimer) {
            clearTimeout(hoverTimer)
            hoverTimer = null
        }
        
        // If no project, clear immediately
        if (!projectId) {
            pendingHoverProject = null
            hideProjectDescription()
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('highlighted')
            })
            return
        }
        
        // If same project, do nothing
        if (pendingHoverProject === projectId) {
            return
        }
        
        // Clear current highlights and description
        hideProjectDescription()
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.remove('highlighted')
        })
        
        // Set pending project
        pendingHoverProject = projectId
        
        // Set timer for 1.5 second delay
        hoverTimer = setTimeout(() => {
            if (pendingHoverProject === projectId) {
                const projectItem = document.querySelector(`[data-project="${projectId}"]`)
                if (projectItem) {
                    projectItem.classList.add('highlighted')
                }
                // Show project description
                showProjectDescription(projectId)
            }
            hoverTimer = null
        }, 1000) // 1 second delay
        
    } catch (error) {
        console.warn('Error highlighting project:', error)
    }
}

function showProjectDescription(projectId) {
    try {
        const descriptionElement = document.querySelector('.project-description')
        const description = projectDescriptions[projectId]
        
        if (description && descriptionElement) {
            descriptionElement.textContent = description
            descriptionElement.classList.add('visible')
        }
    } catch (error) {
        console.warn('Error showing project description:', error)
    }
}

function hideProjectDescription() {
    try {
        const descriptionElement = document.querySelector('.project-description')
        if (descriptionElement) {
            descriptionElement.classList.remove('visible')
            // Clear text after fade-out animation completes
            setTimeout(() => {
                if (!descriptionElement.classList.contains('visible')) {
                    descriptionElement.textContent = ''
                }
            }, 2500) // Match the CSS transition duration
        }
    } catch (error) {
        console.warn('Error hiding project description:', error)
    }
}



// Final navigation (for click or final selection)
function navigateToProject(projectId) {
    // Find the closest plane with the target project ID to camera center
    let targetPlane = null
    let minDistance = Infinity
    
    planes.forEach(planeData => {
        if (planeData.projectId === projectId) {
            const distance = Math.abs(planeData.mesh.position.x - 0) // Distance from center (x=0)
            if (distance < minDistance) {
                minDistance = distance
                targetPlane = planeData
            }
        }
    })
    
    if (targetPlane) {
        // Calculate exact offset to center the selected plane at x=0 (camera center)
        const currentX = targetPlane.mesh.position.x
        const targetPosition = 0 // Exact center
        const offset = currentX - targetPosition
        
        // Smooth GSAP animation to move all planes
        planes.forEach(planeData => {
            gsap.to(planeData.mesh.position, {
                x: planeData.mesh.position.x - offset,
                duration: 1.5,
                ease: "power2.out"
            })
        })
    }
}


/**
 * Animation
 */
const clock = new THREE.Clock()

// Variable to track velocity
let velocity = 0
let smoothVelocity = 0

const tick = () => {
    const elapsedTime = clock.getElapsedTime()
    
    // Update shader uniforms for all planes (moved up to be before other calculations)
    planes.forEach((planeData) => {
        if (planeData.material && planeData.material.uniforms) {
            // Update velocity uniform
            planeData.material.uniforms.uVelo.value = velocity
        }
    })
    
    
    // Hover detection (only when mouse has moved)
    if (mouseHasMoved) {
        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(planes.map(p => p.mesh))
        
        if (intersects.length > 0) {
            const intersectedPlane = intersects[0].object
            const planeData = planes.find(p => p.mesh === intersectedPlane)
            
            if (planeData && hoveredPlane !== planeData.projectId) {
                hoveredPlane = planeData.projectId
                highlightProject(hoveredPlane)
            }
        } else {
            if (hoveredPlane !== null) {
                hoveredPlane = null
                highlightProject(null)
            }
        }
        
        mouseHasMoved = false
    }
    
    // Very smooth interpolation for gradual acceleration
    const isMobileInterp = window.innerWidth <= 768
    const speedInterp = isMobileInterp ? 0.03 : 0.04
    const directionInterp = isMobileInterp ? 0.015 : 0.02
    
    // Smooth interpolation to target speed
    scrollSpeed += (targetScrollSpeed - scrollSpeed) * speedInterp
    
    // Smooth interpolation to target direction with easing
    const directionDiff = targetScrollDirection - scrollDirection
    const easedDirectionInterp = directionInterp * Math.pow(Math.abs(directionDiff), 0.5)
    scrollDirection += directionDiff * easedDirectionInterp
    
    // Combine auto scroll with user scroll, apply direction
    const currentSpeed = (autoScrollSpeed + scrollSpeed) * scrollDirection
    
    // Calculate velocity based on currentSpeed which already handles direction
    const currentVelocity = currentSpeed * -3.0 // Negative because planes move opposite to scroll
    
    // Smooth velocity to avoid sudden changes
    smoothVelocity += (currentVelocity - smoothVelocity) * 0.08
    
    // Final velocity with decay
    velocity = smoothVelocity
    
    // Natural decay when not moving
    if (Math.abs(currentSpeed) < 0.0001) {
        velocity *= 0.985
    }
    
    // Update plane positions
    planes.forEach((planeData) => {
        planeData.mesh.position.x -= currentSpeed
    
        // Reset position for infinite scroll (both directions)
        const resetBoundary = CONFIG.RESET_BOUNDARY
        if (scrollDirection > 0) {
            // Moving left - reset much earlier
            if (planeData.mesh.position.x < -resetBoundary) {
                planeData.mesh.position.x += totalWidth * setsNeeded
            }
        } else {
            // Moving right - reset much earlier
            if (planeData.mesh.position.x > resetBoundary) {
                planeData.mesh.position.x -= totalWidth * setsNeeded
            }
        }
    })
    
    // Smooth deceleration for natural feel
    const isMobileDecel = window.innerWidth <= 768
    const deceleration = isMobileDecel ? 0.98 : 0.99
    targetScrollSpeed *= deceleration
    
    // Render
    renderer.render(scene, camera)
    
    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

// Add click functionality to project items
document.addEventListener('DOMContentLoaded', () => {
    const projectItems = document.querySelectorAll('.project-item')
    
    projectItems.forEach(item => {
        item.addEventListener('click', (event) => {
            const projectId = event.target.getAttribute('data-project')
            console.log(`Selected project ${projectId}`)
            
            // Navigate to project
            navigateToProject(parseInt(projectId))
        })
    })
})

tick()