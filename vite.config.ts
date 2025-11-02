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
  css: {
    devSourcemap: true,
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
      output: {
        // Manual chunking to split large vendors
        manualChunks: {
          // Core React ecosystem
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Wagmi and blockchain
          'web3-vendor': ['wagmi', 'viem', '@privy-io/react-auth'],
          // Supabase
          'supabase-vendor': ['@supabase/supabase-js'],
          // Agora (new - large SDK)
          'agora-vendor': ['agora-rtc-sdk-ng'],
          // UI components
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
          // Charts and visualization
          'charts-vendor': ['recharts', 'lucide-react'],
        },
      },
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
