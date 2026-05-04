/**
 * P3dK Plugin Manager
 * Handles dynamic, on-demand loading of ES6 modules to keep the core engine lightweight.
 */

// 1. Module Registry: Maps module IDs to their respective file paths.
const MODULE_REGISTRY = {
    'xrScanner': './modules/xr-scanner.js',
    'meshOptimizer': './modules/mesh-optimizer.js',
    'advancedMaterials': './modules/advanced-materials.js',
    'kinematics': './modules/kinematics.js',
    'exportUtils': './modules/export-utils.js'
};

// State tracker to prevent duplicate loading. 
// Stores id -> 'loading' | 'loaded' | 'failed'
const loadedModules = new Map();

/**
 * Updates or creates a list item in the UI to reflect the module's load status.
 * @param {HTMLElement} listElement - The <ul> or <ol> container.
 * @param {string} modId - The ID of the module.
 * @param {string} status - 'Downloading...', 'Success [✓]', or 'Failed [✗]'.
 */
function updateModuleUI(listElement, modId, status) {
    let listItem = document.getElementById(`mod-item-${modId}`);
    
    if (!listItem) {
        listItem = document.createElement('li');
        listItem.id = `mod-item-${modId}`;
        listItem.style.marginBottom = '6px';
        listItem.style.fontSize = '11px';
        listElement.appendChild(listItem);
    }
    
    // Assign colors based on status for demoscene aesthetic
    let statusColor = '#0ff'; // Cyan for downloading
    if (status.includes('Success')) statusColor = '#0f9'; // Green
    if (status.includes('Failed')) statusColor = '#ff4444'; // Red

    listItem.innerHTML = `
        <span style="color: #fff; font-weight: bold;">${modId}</span> 
        <span style="color: #888;">(${MODULE_REGISTRY[modId] || 'Unknown URL'})</span> 
        <span style="color: ${statusColor}; margin-left: 8px;">${status}</span>
    `;
}

/**
 * Initializes the plugin manager UI hooks and dependency injection logic.
 * @param {Object} engineCore - The main engine instance/context to inject into plugins.
 */
export function initModuleManager(engineCore) {
    const modSelect = document.getElementById('modSelect');
    const btnLoadMod = document.getElementById('btnLoadMod');
    const moduleList = document.getElementById('moduleList');

    if (!modSelect || !btnLoadMod || !moduleList) {
        console.warn('Plugin Manager: Required DOM elements missing (#modSelect, #btnLoadMod, #moduleList).');
        return;
    }

    btnLoadMod.addEventListener('click', async () => {
        const modId = modSelect.value;
        if (!modId) return;

        // Ensure the module exists in the registry
        const url = MODULE_REGISTRY[modId];
        if (!url) {
            updateModuleUI(moduleList, modId, 'Failed [✗] (Not in Registry)');
            return;
        }

        // Prevent duplicate loads or race conditions
        if (loadedModules.has(modId)) {
            const currentStatus = loadedModules.get(modId);
            if (currentStatus === 'loaded') {
                console.log(`PluginManager: [${modId}] is already loaded.`);
                return;
            }
            if (currentStatus === 'loading') {
                console.log(`PluginManager: [${modId}] is currently downloading...`);
                return;
            }
        }

        // Mark as loading and update UI
        loadedModules.set(modId, 'loading');
        updateModuleUI(moduleList, modId, 'Downloading...');

        try {
            // 3. Dynamic Import execution
            const module = await import(url);
            
            // 5. Dependency Injection: Check for and execute install()
            if (typeof module.install === 'function') {
                module.install(engineCore);
            } else {
                console.warn(`PluginManager: [${modId}] was loaded but has no exported install() function.`);
            }

            // 4. Update state and UI on Success
            loadedModules.set(modId, 'loaded');
            updateModuleUI(moduleList, modId, 'Success [✓]');
            console.log(`PluginManager: Successfully loaded and installed [${modId}].`);

        } catch (error) {
            // 4. Update state and UI on Error
            console.error(`PluginManager: Failed to load [${modId}] from ${url}.`, error);
            loadedModules.set(modId, 'failed');
            updateModuleUI(moduleList, modId, 'Failed [✗]');
        }
    });
}