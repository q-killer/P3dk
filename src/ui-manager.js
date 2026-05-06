/**
 * P3dK // UI Manager 
 * Controls the Cinematic HUD and Scientific Vernacular
 */

export class UIManager {
    constructor() {
        // DOM Elements
        this.statusLog = document.getElementById('status-log');
        this.meshStats = document.getElementById('mesh-stats');
        this.vitruvianReadout = document.getElementById('vitruvian-readout');
        this.exportBtn = document.getElementById('btn-export');
        
        this.initListeners();
    }

    initListeners() {
        if(this.exportBtn) {
            this.exportBtn.addEventListener('click', () => {
                this.setExportingState('model', 'stl');
                // Trigger your export logic here
            });
        }
    }

    // Core System Logs
    logStatus(msg) {
        console.log(`[P3dK Core] ${msg}`);
        if (this.statusLog) this.statusLog.innerHTML = msg;
    }

    // Uses Δ for geometric polygons
    updateMeshStats(tris, filesCount) {
        if (this.meshStats) {
            this.meshStats.innerHTML = `<span class="highlight">Δ ${tris.toLocaleString()}</span> [${filesCount} FILES]`;
        }
    }

    // Uses Σ for compilation/summation processing
    setExportingState(prefix, format) {
        this.logStatus(`Σ COMPILING ${prefix.toUpperCase()} → .${format.toUpperCase()}...`);
    }

    // Vitruvian Spatial Overlay (Called by holographic cursors)
    showVitruvianOverlay(distance, angle, tolerance = null) {
        if (!this.vitruvianReadout) return;
        
        this.vitruvianReadout.style.display = 'block';
        let readout = `Δ ${distance.toFixed(2)} mm <br> θ ${angle.toFixed(1)}°`;
        
        if (tolerance) {
            readout += `<br> ε ${tolerance.toFixed(2)} mm`;
        }
        
        this.vitruvianReadout.innerHTML = readout;
    }

    hideVitruvianOverlay() {
        if (this.vitruvianReadout) {
            this.vitruvianReadout.style.display = 'none';
        }
    }
}

// Export a singleton instance
export const ui = new UIManager();