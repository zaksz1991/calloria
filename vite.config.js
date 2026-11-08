import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/',
  publicDir: false,
  appType: 'spa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        customerCare: resolve(process.cwd(), 'customer-care.html'),
        caseDesk: resolve(process.cwd(), 'case-desk.html'),
        customer360: resolve(process.cwd(), 'customer-360.html'),
        agentDesk: resolve(process.cwd(), 'agent-desk.html'),
        workforce: resolve(process.cwd(), 'workforce.html'),
        performance: resolve(process.cwd(), 'performance.html'),
        salesDesk: resolve(process.cwd(), 'sales-desk.html'),
        supportRouter: resolve(process.cwd(), 'support-router.html'),
        routingControl: resolve(process.cwd(), 'routing-control.html'),
        voiceSimulator: resolve(process.cwd(), 'voice-simulator.html'),
        whatsappInbox: resolve(process.cwd(), 'whatsapp-inbox.html'),
        emailInbox: resolve(process.cwd(), 'email-inbox.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-engine';
        }
      }
    }
  },
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true }
});
