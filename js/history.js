// CollabFlow - Undo/redo history

import AppState, { emitStateChange } from './state.js';
import { deepClone } from './utils.js';
import { renderAllElements } from './elements.js';
import { renderAllConnections } from './connectors.js';

// Capture current state snapshot
function captureSnapshot() {
    return {
        elements: deepClone(Object.fromEntries(AppState.elements)),
        connections: deepClone(Object.fromEntries(AppState.connections))
    };
}

// Restore a snapshot
function restoreSnapshot(snapshot) {
    AppState.elements.clear();
    for (const [id, el] of Object.entries(snapshot.elements)) {
        AppState.elements.set(id, el);
    }

    AppState.connections.clear();
    for (const [id, conn] of Object.entries(snapshot.connections)) {
        AppState.connections.set(id, conn);
    }

    AppState.selection.clear();
    renderAllElements();
    renderAllConnections();
    emitStateChange('state:restored', {});
}

// Push current state to undo stack (call BEFORE making changes)
export function pushHistory(action = '') {
    const snapshot = captureSnapshot();
    snapshot.action = action;
    AppState.undoStack.push(snapshot);

    // Limit stack size
    if (AppState.undoStack.length > AppState.maxHistorySize) {
        AppState.undoStack.shift();
    }

    // Clear redo stack on new action
    AppState.redoStack = [];

    updateHistoryButtons();
}

// Undo last action
export function undo() {
    if (AppState.undoStack.length === 0) return;

    // Save current state to redo stack
    AppState.redoStack.push(captureSnapshot());

    // Pop and restore previous state
    const snapshot = AppState.undoStack.pop();
    restoreSnapshot(snapshot);

    updateHistoryButtons();
    emitStateChange('history:undo', {});
}

// Redo last undone action
export function redo() {
    if (AppState.redoStack.length === 0) return;

    // Save current state to undo stack
    AppState.undoStack.push(captureSnapshot());

    // Pop and restore redo state
    const snapshot = AppState.redoStack.pop();
    restoreSnapshot(snapshot);

    updateHistoryButtons();
    emitStateChange('history:redo', {});
}

// Update undo/redo button states
function updateHistoryButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (undoBtn) {
        undoBtn.disabled = AppState.undoStack.length === 0;
        undoBtn.style.opacity = AppState.undoStack.length === 0 ? '0.3' : '1';
    }
    if (redoBtn) {
        redoBtn.disabled = AppState.redoStack.length === 0;
        redoBtn.style.opacity = AppState.redoStack.length === 0 ? '0.3' : '1';
    }
}

// Check if undo/redo is available
export function canUndo() {
    return AppState.undoStack.length > 0;
}

export function canRedo() {
    return AppState.redoStack.length > 0;
}
