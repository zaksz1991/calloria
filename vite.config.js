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
import { calloriaOutboundCampaignV45Plugin } from './build/calloria-outbound-campaign-v4-5-plugin.mjs';
import { calloriaMobileResponsiveRepairPlugin } from './build/calloria-mobile-responsive-repair-v6-10.mjs';
import { calloriaVoiceResponseWorkflowPlugin } from './build/calloria-voice-response-workflow-v6-42.mjs';
import { calloriaInboundCustomerDialoguePlugin } from './build/calloria-inbound-customer-dialogue-v6-43.mjs';
import { calloriaInboundConversationWrapUpPlugin } from './build/calloria-inbound-conversation-wrapup-v6-44.mjs';
import { calloriaInboundQAReviewBridgePlugin } from './build/calloria-inbound-qa-review-bridge-v6-45.mjs';
import { calloriaQACoachingFollowThroughPlugin } from './build/calloria-qa-coaching-followthrough-v6-46.mjs';
import { calloriaGuidedCoachingPracticePlugin } from './build/calloria-guided-coaching-practice-v6-47.mjs';
import { calloriaCareerCompetencyPassportPlugin } from './build/calloria-career-competency-passport-v6-48.mjs';
import { calloriaPromotionReadinessDossierPlugin } from './build/calloria-promotion-readiness-dossier-v6-49.mjs';
import { calloriaScenarioBasedPromotionExamPlugin } from './build/calloria-scenario-based-promotion-exam-v6-50.mjs';
import { calloriaRuffNeckPlatformSupportPlugin } from './build/calloria-ruffneck-platform-support-v6-51.mjs';
import { calloriaPlatformSupportCaseDeskPluginV652 } from './build/calloria-platform-support-case-desk-v6-52.mjs';
import { calloriaSupportSlaCommandCentrePluginV653 } from './build/calloria-support-sla-command-centre-v6-53.mjs';

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
    // The outbound campaign plugin runs after v4.4 has transformed the inbound/shift workflow.
    calloriaOutboundCampaignV45Plugin(),
    // Final post-transform: mobile first-person safety, responsive CSS and assessment controls.
    calloriaMobileResponsiveRepairPlugin(),
    // Voice transcript logging must run before the scripted customer dialogue bridge.
    calloriaVoiceResponseWorkflowPlugin(),
    calloriaInboundCustomerDialoguePlugin(),
    // Conversation-aware after-contact work runs after the v6.43 dialogue injection.
    calloriaInboundConversationWrapUpPlugin(),
    // Completed inbound cases enter the existing evidence-based human QA workspace.
    calloriaInboundQAReviewBridgePlugin(),
    // QA review outcomes now create trackable coaching actions with evidence-based follow-up.
    calloriaQACoachingFollowThroughPlugin(),
    // Criterion-based practice sits inside the existing QA coaching action plans.
    calloriaGuidedCoachingPracticePlugin(),
    // Career profile consumes only human-confirmed QA coaching outcomes.
    calloriaCareerCompetencyPassportPlugin(),
    // Promotion dossier reuses the exact Workforce promotion KPI and attempt rules.
    calloriaPromotionReadinessDossierPlugin(),
    // The scenario exam replaces self-entered marks and records scored response evidence.
    calloriaScenarioBasedPromotionExamPlugin(),
    // Service directory and RuffNeck customer-support practice run after the Workforce exam transforms.
    calloriaRuffNeckPlatformSupportPlugin(),
    // The v6.52 ticket desk extends the service playbooks into CRM-backed case handling.
    calloriaPlatformSupportCaseDeskPluginV652(),
    // Cross-platform SLA ageing and breach escalation run after the v6.52 case desk.
    calloriaSupportSlaCommandCentrePluginV653()
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
