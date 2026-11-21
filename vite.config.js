import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { calloriaGLBWorldPlugin } from './build/calloria-glb-world-plugin.js';
import { calloriaMeshoptRuntimePlugin } from './build/calloria-meshopt-runtime-plugin.js';
import { calloriaStaticGLBStaffPlugin } from './build/calloria-static-glb-staff-plugin.mjs';
import { calloriaCC0StaffGLBBundlePlugin } from './build/calloria-cc0-staff-glb-bundle-plugin.mjs';
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
import { calloriaGlazedDepartmentPartitionsPlugin } from './build/calloria-glazed-department-partitions-plugin.mjs';
import { calloriaOJTGLBActivationPlugin } from './build/calloria-ojt-glb-activation-plugin.mjs';
import { calloriaFirstWorkingShiftV44Plugin } from './build/calloria-first-working-shift-v4-4-plugin.mjs';
import { calloriaMobileResponsiveRepairPlugin } from './build/calloria-mobile-responsive-repair-v6-10.mjs';
import { calloriaRuffNeckServiceOperationsPluginV686 } from './build/calloria-ruffneck-service-operations-v6-86.mjs';
import { calloriaCareerDevelopmentPluginV688 } from './build/calloria-career-development-v6-88.mjs';
import { calloriaPublicExperienceHubPlugin } from './build/calloria-public-experience-hub-v6-55.mjs';
import { calloriaRuffNeckDiscoveryGuidePlugin } from './build/calloria-ruffneck-discovery-guide-v6-56.mjs';
import { calloriaSeamlessProductHandoffPlugin } from './build/calloria-seamless-product-handoff-v6-57.mjs';
import { calloriaTryItStudioPlugin } from './build/calloria-try-it-studio-v6-58.mjs';
export default defineConfig({
  base: '/',
  publicDir: 'public',
  appType: 'spa',
  plugins: [
    calloriaGLBWorldPlugin(),
    calloriaMeshoptRuntimePlugin(),
    calloriaStaticGLBStaffPlugin(),
    // Keep this after the static staff transform and before the OJT plugin.
    // It downloads validated CC0 GLBs during buildStart, then the OJT plugin
    // checks the same public asset paths and wires the runtime decoders.
    calloriaCC0StaffGLBBundlePlugin(),
    calloriaCustomerAvatarPlugin(),
    calloriaCustomerWorldPlugin(),
    calloriaSupervisorInterventionPlugin(),
    calloriaSupervisorCaseBridgePlugin(),
    calloriaFirstShiftGameplayPlugin(),
    calloriaThirdPersonPlayerPlugin(),
    calloriaWorkstationExperiencePlugin(),
    calloriaCC0OfficeLobbyPlugin(),
    calloriaErgonomicOfficeChairsPlugin(),
    calloriaCC0LobbyGreeneryPlugin(),
    calloriaGlazedDepartmentPartitionsPlugin(),
    // Keep the GLB/OJT transformer after all existing world and office transforms.
    calloriaOJTGLBActivationPlugin(),
    // The live-shift integration runs after OJT has inserted its employment gate.
    calloriaFirstWorkingShiftV44Plugin(),
    // Final post-transform: mobile first-person safety, responsive CSS and assessment controls.
    calloriaMobileResponsiveRepairPlugin(),
    // Native voice response, inbound dialogue and after-contact work already live in main.js.
    // The consolidated career plugin bridges completed voice transcripts into human QA,
    // then links QA evidence to coaching, guided practice, coach sign-off and scenario exams.
    // It runs after the RuffNeck workforce transform so both feature panels share the final view.
    calloriaRuffNeckServiceOperationsPluginV686(),
    calloriaCareerDevelopmentPluginV688(),
    // Last: visitor-facing HTML and navigation only; gameplay logic remains unchanged.
    calloriaPublicExperienceHubPlugin(),
    // Guided visitor intent selection routes people to the most relevant official RuffNeck destination.
    calloriaRuffNeckDiscoveryGuidePlugin(),
    // Product cards now prefill the existing consent-based human support router for interested visitors.
    calloriaSeamlessProductHandoffPlugin(),
    // Adds guest-friendly, fictional sample experiences before visitors leave for official RuffNeck destinations.
    calloriaTryItStudioPlugin()
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
