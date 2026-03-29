// CollabFlow - Main application entry point

import AppState from './state.js';
import { initCanvas, applyTransform } from './canvas.js';
import { screenToCanvas } from './canvas.js';
import { getElementAtPosition } from './elements.js';
import { initDrag, initPlacement } from './drag.js';
import { initShortcuts } from './shortcuts.js';
import { initTheme } from './theme.js';
import { initUI } from './ui.js';
import { initEditor, startEditing } from './editor.js';
import { initMinimap } from './minimap.js';
import { initFirebase, checkAutoJoin } from './collaboration.js';
import { onStateChange } from './state.js';

// Expose functions that other modules need via lazy imports
window.__collabflow_screenToCanvas = screenToCanvas;
window.__collabflow_getElementAtPosition = getElementAtPosition;
window.__collabflow_applyTransform = applyTransform;

async function init() {
    // Initialize theme first (prevents flash)
    initTheme();

    // Initialize canvas (SVG, grid, zoom, pan)
    initCanvas();

    // Initialize interaction modules
    initDrag();
    initPlacement();
    initShortcuts();

    // Initialize inline editor (double-click)
    setupDoubleClick();

    // Initialize UI (toolbar, sidebar, modals)
    initUI();

    // Initialize minimap
    initMinimap();

    // Track element count in status bar
    const updateCount = () => {
        const el = document.getElementById('element-count');
        if (el) {
            const n = AppState.elements.size;
            el.textContent = `${n} element${n !== 1 ? 's' : ''}`;
        }
    };
    onStateChange('element:added', updateCount);
    onStateChange('element:removed', updateCount);
    onStateChange('state:restored', updateCount);

    // Initialize Firebase and check for room in URL
    await initFirebase();
    await checkAutoJoin();
}

// Set up double-click for inline editing
function setupDoubleClick() {
    const svg = document.getElementById('canvas');

    svg.addEventListener('dblclick', (e) => {
        if (AppState.mode !== 'idle') return;

        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const element = getElementAtPosition(canvasPos.x, canvasPos.y);

        if (element) {
            startEditing(element.id);
        }
    });
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
