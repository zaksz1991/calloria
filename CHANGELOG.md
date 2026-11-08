# CALLORIA Customer Avatar v1.5

- Reuses the existing avatar renderer and loaded customer model when Customer Intelligence Lab re-renders for another conversation turn and the selected customer asset is unchanged.
- Rebinds the retained canvas to the newly rendered customer stage instead of repeatedly creating and disposing WebGL contexts.
- Updates customer emotion, persona, reaction, caption and matching embedded animation clip from the latest practice state.
- Smoothly blends skeletal body-language offsets after each agent response.
- Keeps explicit GLB Inspector approval, runtime model budgets, Meshopt-capable shared loading and the no-3D fallback.
- Keeps the existing Vite plugin, main.js, customer-intelligence engine, and production-world source untouched.
