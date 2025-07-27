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
                project: resolve(__dirname, 'src/project.html')
            }
        }
    },
    plugins:
    [
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        glsl() // Handle shader files
    ]
}