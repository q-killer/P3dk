// Add this global flag
let sessionDirty = false;

// Call this function ANY time the user modifies the mesh, materials, or UI.
// e.g., sessionDirty = true;

// 1. Graceful Exit Protection (Fires on tab close, refresh, or switching tabs)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sessionDirty) {
    saveSession();
    sessionDirty = false;
  }
});

// 2. Hard Crash Protection (Checks every 10 seconds, saves only if changes occurred)
setInterval(() => {
  if (sessionDirty) {
    saveSession();
    sessionDirty = false;
  }
}, 10000); 

// OPTIONAL: Auto-load on boot
// Call this at the very end of your main init() function
window.addEventListener('DOMContentLoaded', loadSession);