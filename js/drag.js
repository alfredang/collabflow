// CollabFlow - Drag and drop interaction

import AppState, { emitStateChange } from './state.js';
import { snap } from './utils.js';
import { screenToCanvas } from './canvas.js';
import { updateElementPosition, getElementAtPosition, getPortAtPosition, renderElement } from './elements.js';
import { updateConnectionsForElement, renderTempConnection, hideTempConnection, createConnection, addConnection } from './connectors.js';
import { selectElement, clearSelection, toggleSelection, startRubberBand, updateRubberBand, endRubberBand } from './selection.js';
import { pushHistory } from './history.js';
import { getPortPositions } from './utils.js';

const DRAG_THRESHOLD = 3;

let pointerDownPos = null;
let isDragging = false;
let isConnecting = false;
let isRubberBanding = false;
let connectingFromPort = null;

export function initDrag() {
    const svg = document.getElementById('canvas');

    svg.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
}

function onPointerDown(e) {
    if (e.button !== 0) return; // Only left click
    if (AppState.mode === 'panning') return;
    if (AppState.mode === 'editing') return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    pointerDownPos = { screenX: e.clientX, screenY: e.clientY, canvasX: canvasPos.x, canvasY: canvasPos.y };

    // Check if clicking on a port
    const port = getPortAtPosition(canvasPos.x, canvasPos.y);
    if (port && AppState.activeTool === 'select') {
        isConnecting = true;
        connectingFromPort = port;
        AppState.mode = 'connecting';
        e.stopPropagation();
        return;
    }

    // Check if clicking on connector tool or port
    if (AppState.activeTool === 'connector') {
        const element = getElementAtPosition(canvasPos.x, canvasPos.y);
        if (element) {
            const ports = getPortPositions(element);
            // Find closest port
            let closestPort = null;
            let closestDist = Infinity;
            for (const [name, pos] of Object.entries(ports)) {
                const dx = canvasPos.x - pos.x;
                const dy = canvasPos.y - pos.y;
                const dist = dx * dx + dy * dy;
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPort = { elementId: element.id, port: name, x: pos.x, y: pos.y };
                }
            }
            if (closestPort) {
                isConnecting = true;
                connectingFromPort = closestPort;
                AppState.mode = 'connecting';
                e.stopPropagation();
                return;
            }
        }
        return;
    }

    // Check if clicking on an element
    const element = getElementAtPosition(canvasPos.x, canvasPos.y);

    if (element) {
        if (e.shiftKey) {
            toggleSelection(element.id);
        } else if (!AppState.selection.has(element.id)) {
            selectElement(element.id);
        }
        // Prepare for potential drag
        isDragging = false; // Will become true after threshold
        AppState.mode = 'dragging';

        // Store offsets for all selected elements
        AppState.dragOffsets.clear();
        for (const id of AppState.selection) {
            const el = AppState.elements.get(id);
            if (el) {
                AppState.dragOffsets.set(id, {
                    dx: el.x - canvasPos.x,
                    dy: el.y - canvasPos.y
                });
            }
        }
    } else {
        // Clicking on empty canvas
        if (!e.shiftKey) {
            clearSelection();
        }
        // Start rubber band
        isRubberBanding = true;
        AppState.mode = 'rubber_band';
        startRubberBand(canvasPos.x, canvasPos.y);
    }
}

function onPointerMove(e) {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    // Update cursor position for collaboration
    emitStateChange('cursor:moved', { x: canvasPos.x, y: canvasPos.y });

    if (AppState.mode === 'connecting' && isConnecting) {
        // Draw temp connection line
        const fromPos = connectingFromPort;
        renderTempConnection(
            { x: fromPos.x, y: fromPos.y },
            { x: canvasPos.x, y: canvasPos.y }
        );
        return;
    }

    if (AppState.mode === 'rubber_band' && isRubberBanding) {
        updateRubberBand(canvasPos.x, canvasPos.y);
        return;
    }

    if (AppState.mode === 'dragging' && pointerDownPos) {
        // Check drag threshold
        const dx = e.clientX - pointerDownPos.screenX;
        const dy = e.clientY - pointerDownPos.screenY;

        if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            isDragging = true;
            // Save state for undo before starting drag
            pushHistory('move');
        }

        if (isDragging) {
            // Move all selected elements
            for (const id of AppState.selection) {
                const offset = AppState.dragOffsets.get(id);
                if (offset) {
                    const el = AppState.elements.get(id);
                    if (el && !el.locked) {
                        const newX = AppState.snapToGrid ? snap(canvasPos.x + offset.dx) : canvasPos.x + offset.dx;
                        const newY = AppState.snapToGrid ? snap(canvasPos.y + offset.dy) : canvasPos.y + offset.dy;
                        el.x = newX;
                        el.y = newY;
                        renderElement(id);
                        updateConnectionsForElement(id);
                    }
                }
            }
        }
    }
}

function onPointerUp(e) {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    if (AppState.mode === 'connecting' && isConnecting) {
        hideTempConnection();

        // Check if released on a port
        const targetPort = getPortAtPosition(canvasPos.x, canvasPos.y, connectingFromPort.elementId);
        if (targetPort && targetPort.elementId !== connectingFromPort.elementId) {
            // Create connection
            const conn = createConnection(
                connectingFromPort.elementId,
                connectingFromPort.port,
                targetPort.elementId,
                targetPort.port
            );
            pushHistory('connect');
            addConnection(conn);
        }

        isConnecting = false;
        connectingFromPort = null;
        AppState.mode = 'idle';
        return;
    }

    if (AppState.mode === 'rubber_band' && isRubberBanding) {
        endRubberBand();
        isRubberBanding = false;
        AppState.mode = 'idle';
        return;
    }

    if (AppState.mode === 'dragging') {
        if (isDragging) {
            // Emit final positions for collaboration sync
            for (const id of AppState.selection) {
                const el = AppState.elements.get(id);
                if (el) {
                    emitStateChange('element:moved', { id, x: el.x, y: el.y });
                }
            }
        }
        isDragging = false;
        AppState.mode = 'idle';
        AppState.dragOffsets.clear();
    }

    pointerDownPos = null;
}

// Handle placing new elements from toolbar
export function initPlacement() {
    const svg = document.getElementById('canvas');

    svg.addEventListener('click', (e) => {
        if (AppState.activeTool === 'select' || AppState.activeTool === 'connector') return;
        if (AppState.mode !== 'idle' && AppState.mode !== 'placing') return;

        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        // Import createElement and addElement dynamically to avoid circular deps
        import('./elements.js').then(({ createElement, addElement }) => {
            pushHistory('add');
            const element = createElement(AppState.activeTool, canvasPos.x, canvasPos.y);
            addElement(element);
            selectElement(element.id);

            // Switch back to select tool after placing
            setActiveTool('select');
        });
    });
}

// Set the active tool
export function setActiveTool(tool) {
    AppState.activeTool = tool;
    const svg = document.getElementById('canvas');

    // Clear selection when switching away from select tool
    if (tool !== 'select') {
        clearSelection();
    }

    // Update cursor
    if (tool === 'select') {
        svg.classList.remove('cursor-crosshair', 'cursor-connecting');
    } else if (tool === 'connector') {
        svg.classList.add('cursor-connecting');
        svg.classList.remove('cursor-crosshair');
    } else {
        svg.classList.add('cursor-crosshair');
        svg.classList.remove('cursor-connecting');
    }

    // Update all tool button states (sidebar + toolbar)
    document.querySelectorAll('[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    emitStateChange('tool:changed', { tool });
}
