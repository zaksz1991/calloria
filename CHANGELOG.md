# Changelog — v2.2

- Activates the committed office GLB integration through the existing
  `calloriaGLBWorldPlugin()` Vite slot.
- Connects the existing staff GLB layer and office GLB layer to one renderer loop.
- Moves the immersive starting position to the approach point of Agent Station 11.
- Dispatches consistent custom events for workstation proximity, USE and immersive state.
- Reworks the first-shift mission card to guide the player through the existing
  workstation operation panel.
- Reports staff GLB and office GLB counts separately.
- Preserves original geometry fallbacks when an external GLB fails validation.
