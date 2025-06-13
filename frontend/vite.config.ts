import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'https://doceasy-bcd3.onrender.com',
        changeOrigin: true
      }
    }
  },
  plugins: [
    // Use default React plugin configuration
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Provide fallback values for production environment variables
    'import.meta.env.VITE_API_URL': JSON.stringify(
      mode === 'production' 
        ? 'https://doceasy-bcd3.onrender.com'
        : 'http://localhost:5000'
    ),
  },
  build: {
    // Improve production build stability
    sourcemap: true,
    // Use esbuild for minification instead of terser (which is not installed)
    minify: 'esbuild',
    // Configure esbuild minification options
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate WebRTC code into its own chunk
          webrtc: ['./src/lib/webrtc.ts'],
          // Separate React code
          react: ['react', 'react-dom'],
          // Separate router code
          router: ['react-router-dom']
        }
      }
    }
  }
}));
