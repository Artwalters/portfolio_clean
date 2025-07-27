import restart from 'vite-plugin-restart'
import glsl from 'vite-plugin-glsl'
import { resolve } from 'path'

export default {
    root: 'src/',
    publicDir: '../static/',
    base: '/portfolio_clean/',
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: true, // Add sourcemap
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                project1: resolve(__dirname, 'src/project-1.html'),
                project2: resolve(__dirname, 'src/project-2.html'),
                project3: resolve(__dirname, 'src/project-3.html'),
                project4: resolve(__dirname, 'src/project-4.html'),
                project5: resolve(__dirname, 'src/project-5.html'),
                project6: resolve(__dirname, 'src/project-6.html'),
                project7: resolve(__dirname, 'src/project-7.html')
            }
        }
    },
    plugins:
    [
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        glsl() // Handle shader files
    ]
}