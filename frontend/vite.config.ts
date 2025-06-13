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
    react({
      // Disable React strict mode in production to avoid double-rendering issues
      jsxImportSource: undefined,
      plugins: [],
      // Fix for React rendering issues with WebRTC
      fastRefresh: mode !== 'production',
      // Critical fix for the specific error we're seeing
      swcOptions: {
        jsc: {
          transform: {
            react: {
              // Disable development mode features in production
              development: mode !== 'production',
              // Disable strict mode to prevent double-rendering
              useBuiltins: true,
              refresh: mode !== 'production'
            }
          }
        }
      }
    }),
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
    minify: 'terser',
    terserOptions: {
      compress: {
        // Disable features that might cause issues with WebRTC
        keep_infinity: true,
        pure_getters: false,
        passes: 1
      },
      mangle: {
        // Prevent mangling of MediaStream related code
        reserved: ['MediaStream', 'RTCPeerConnection', 'addTrack', 'ontrack']
      },
      format: {
        // Preserve comments with "important" in them
        comments: /important/
      }
    },
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
