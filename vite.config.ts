import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // parquet-wasm must NOT be pre-bundled — it ships its own WASM loader
  optimizeDeps: {
    exclude: ['parquet-wasm'],
    // apache-arrow uses top-level await in some entry paths; mark as ESM
    include: [],
  },

  // Required for WASM + SharedArrayBuffer in dev
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  // Workers run as ES modules so they can use dynamic imports and import.meta.url
  worker: {
    format: 'es',
    // Exclude parquet-wasm from worker pre-bundling too
    rollupOptions: {
      external: [],
    },
  },

  // Wide target for BigInt, top-level await, and WASM features
  build: {
    target: 'esnext',
  },

  // Tell Vite to treat WASM files as assets
  assetsInclude: ['**/*.wasm', '**/*.svg', '**/*.csv'],
})
