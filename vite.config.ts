import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      clientPort: 8080,
    },
    fs: {
      // Don't serve x402-temp example files
      deny: ['**/x402-temp/**'],
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      'protobufjs/minimal': 'protobufjs/minimal.js',
    },
    dedupe: ['react', 'react-dom', 'styled-components'],
  },
  optimizeDeps: {
    exclude: ['@xmtp/browser-sdk', 'x402-temp'],
    include: ['react', 'react-dom', 'protobufjs/minimal', 'styled-components'],
    esbuildOptions: {
      target: 'esnext',
    },
    entries: [
      // Only scan our actual app source, not x402-temp examples
      'src/**/*.{ts,tsx}',
      'index.html',
    ],
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 5000, // Increase chunk size warning limit to 5MB
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/protobufjs/, /node_modules/],
    },
    rollupOptions: {
      // Exclude x402-temp example files from build
      external: [/x402-temp/],
      onwarn(warning, warn) {
        // Suppress PURE annotation warnings
        if (warning.code === 'INVALID_ANNOTATION' && warning.message.includes('/*#__PURE__*/')) {
          return;
        }
        // Suppress eval warnings from protobufjs
        if (warning.code === 'EVAL' && warning.id?.includes('protobufjs')) {
          return;
        }
        // Suppress unresolved imports from x402-temp examples
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('x402-temp')) {
          return;
        }
        // Use default for everything else
        warn(warning);
      },
    },
  },
}));
