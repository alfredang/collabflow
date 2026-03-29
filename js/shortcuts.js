// CollabFlow - Keyboard shortcuts

import AppState from './state.js';
import { undo, redo } from './history.js';
import { selectAll, clearSelection, getSelectedElements, getSelectedConnections } from './selection.js';
import { removeElement } from './elements.js';
import { removeConnection, removeConnectionsForElement } from './connectors.js';
import { pushHistory } from './history.js';
import { deepClone } from './utils.js';
import { setActiveTool } from './drag.js';
import { zoomIn, zoomOut, resetZoom, zoomToFit } from './canvas.js';
import { finishEditing } from './editor.js';

export function initShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Skip if editing text in an input/textarea
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            if (e.key === 'Escape') {
                document.activeElement.blur();
                finishEditing();
            }
            return;
        }

        const ctrl = e.ctrlKey || e.metaKey;

        // Undo: Ctrl+Z
        if (ctrl && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }

        // Redo: Ctrl+Shift+Z or Ctrl+Y
        if ((ctrl && e.key === 'z' && e.shiftKey) || (ctrl && e.key === 'y')) {
            e.preventDefault();
            redo();
            return;
        }

        // Select all: Ctrl+A
        if (ctrl && e.key === 'a') {
            e.preventDefault();
            selectAll();
            return;
        }

        // Copy: Ctrl+C
        if (ctrl && e.key === 'c') {
            e.preventDefault();
            copySelection();
            return;
        }

        // Paste: Ctrl+V
        if (ctrl && e.key === 'v') {
            e.preventDefault();
            pasteClipboard();
            return;
        }

        // Cut: Ctrl+X
        if (ctrl && e.key === 'x') {
            e.preventDefault();
            copySelection();
            deleteSelection();
            return;
        }

        // Duplicate: Ctrl+D
        if (ctrl && e.key === 'd') {
            e.preventDefault();
            duplicateSelection();
            return;
        }

        // Delete: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteSelection();
            return;
        }

        // Escape: clear selection or cancel mode
        if (e.key === 'Escape') {
            if (AppState.mode === 'editing') {
                finishEditing();
            } else {
                clearSelection();
                setActiveTool('select');
            }
            return;
        }

        // Tool shortcuts
        if (e.key === 'v' || e.key === '1') { setActiveTool('select'); return; }
        if (e.key === 'r' || e.key === '2') { setActiveTool('process'); return; }
        if (e.key === 'd' && !ctrl || e.key === '3') { setActiveTool('decision'); return; }
        if (e.key === 's' && !ctrl || e.key === '4') { setActiveTool('start_end'); return; }
        if (e.key === 't' || e.key === '5') { setActiveTool('text_label'); return; }
        if (e.key === 'c' && !ctrl || e.key === '6') { setActiveTool('connector'); return; }

        // Zoom shortcuts
        if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); return; }
        if (ctrl && e.key === '-') { e.preventDefault(); zoomOut(); return; }
        if (ctrl && e.key === '0') { e.preventDefault(); resetZoom(); return; }
        if (ctrl && e.key === '1' && e.shiftKey) { e.preventDefault(); zoomToFit(); return; }
    });
}

function copySelection() {
    AppState.clipboard = [];
    for (const id of AppState.selection) {
        const el = AppState.elements.get(id);
        if (el) {
            AppState.clipboard.push(deepClone(el));
        }
    }
}

function pasteClipboard() {
    if (AppState.clipboard.length === 0) return;

    pushHistory('paste');
    const { addElement } = require('./elements.js');
    const newIds = new Map();

    clearSelection();

    for (const elData of AppState.clipboard) {
        const newEl = deepClone(elData);
        const oldId = newEl.id;
        newEl.id = 'el_' + Math.random().toString(36).substr(2, 8);
        newEl.x += 30;
        newEl.y += 30;
        newIds.set(oldId, newEl.id);

        AppState.elements.set(newEl.id, newEl);
        import('./elements.js').then(m => m.renderElement(newEl.id));
        AppState.selection.add(newEl.id);
    }

    // Update clipboard offsets for subsequent pastes
    AppState.clipboard = AppState.clipboard.map(el => {
        el = deepClone(el);
        el.x += 30;
        el.y += 30;
        return el;
    });
}

function duplicateSelection() {
    copySelection();
    pasteClipboard();
}

function deleteSelection() {
    if (AppState.selection.size === 0) return;

    pushHistory('delete');

    const idsToDelete = [...AppState.selection];
    for (const id of idsToDelete) {
        if (AppState.elements.has(id)) {
            removeConnectionsForElement(id);
            removeElement(id);
        } else if (AppState.connections.has(id)) {
            removeConnection(id);
        }
    }

    AppState.selection.clear();
}
