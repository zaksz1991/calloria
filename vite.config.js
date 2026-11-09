import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { calloriaGLBWorldPlugin } from './build/calloria-glb-world-plugin.js';
import { calloriaMeshoptRuntimePlugin } from './build/calloria-meshopt-runtime-plugin.js';
import { calloriaStaticGLBStaffPlugin } from './build/calloria-static-glb-staff-plugin.mjs';
import { calloriaCustomerAvatarPlugin } from './build/calloria-customer-avatar-plugin.js';
import { calloriaCustomerWorldPlugin } from './build/calloria-customer-world-plugin.js';
import { calloriaSupervisorInterventionPlugin } from './build/calloria-supervisor-intervention-plugin.js';
import { calloriaSupervisorCaseBridgePlugin } from './build/calloria-supervisor-case-bridge-plugin.js';
import { calloriaFirstShiftGameplayPlugin } from './build/calloria-first-shift-gameplay-plugin.js';
import { calloriaThirdPersonPlayerPlugin } from './build/calloria-third-person-player-plugin.mjs';
import { calloriaWorkstationExperiencePlugin } from './build/calloria-workstation-experience-plugin.mjs';
import { calloriaCC0OfficeLobbyPlugin } from './build/calloria-cc0-office-lobby-plugin.mjs';
import { calloriaErgonomicOfficeChairsPlugin } from './build/calloria-ergonomic-office-chairs-plugin.mjs';
import { calloriaCC0LobbyGreeneryPlugin } from './build/calloria-cc0-lobby-greenery-plugin.mjs';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  appType: 'spa',
  plugins: [
    calloriaGLBWorldPlugin(),
    calloriaMeshoptRuntimePlugin(),
    calloriaStaticGLBStaffPlugin(),
    calloriaCustomerAvatarPlugin(),
    calloriaCustomerWorldPlugin(),
    // Supervisor world integration consumes customer-world lifecycle anchors.
    calloriaSupervisorInterventionPlugin(),
    calloriaSupervisorCaseBridgePlugin(),
    // Existing gameplay bridge emits shift, call, case and station events.
    calloriaFirstShiftGameplayPlugin(),
    // Third-person character consumes the existing production-world frame loop.
    calloriaThirdPersonPlayerPlugin(),
    // Existing operations remain open in the active 3D workplace.
    calloriaWorkstationExperiencePlugin(),
    // Add the real CC0 reception/lobby only after the GLB-first world transform.
    calloriaCC0OfficeLobbyPlugin(),
    // Real CC0 ergonomic task chairs upgrade the selected GLB workstation rows.
    calloriaErgonomicOfficeChairsPlugin(),
    // Fill authored reception planters with a lightweight CC0 greenery GLB.
    calloriaCC0LobbyGreeneryPlugin()
  ],
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
        emailInbox: resolve(process.cwd(), 'email-inbox.html'),
        liveChatInbox: resolve(process.cwd(), 'live-chat-inbox.html'),
        socialInbox: resolve(process.cwd(), 'social-inbox.html'),
        voiceConsole: resolve(process.cwd(), 'voice-console.html'),
        smsInbox: resolve(process.cwd(), 'sms-inbox.html'),
        operationsIntelligence: resolve(process.cwd(), 'operations-intelligence.html'),
        knowledgeOperations: resolve(process.cwd(), 'knowledge-operations.html'),
        assetInspector: resolve(process.cwd(), 'asset-inspector.html'),
        calloriaChatWidget: resolve(process.cwd(), 'widgets/calloria-chat.js')
      },
      output: {
        entryFileNames(chunk) {
          return chunk.name === 'calloriaChatWidget'
            ? 'widgets/calloria-chat.js'
            : 'assets/[name]-[hash].js';
        },
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-engine';
        }
      }
    }
  },
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true }
});
