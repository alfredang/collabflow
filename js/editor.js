// CollabFlow - Inline text editing and properties panel

import AppState, { emitStateChange } from './state.js';
import { createSvgElement, SVG_NS } from './utils.js';
import { updateElementText, updateElementStyle, renderElement } from './elements.js';
import { updateConnectionLabel, renderConnection } from './connectors.js';
import { pushHistory } from './history.js';

// Start inline text editing for an element
export function startEditing(elementId) {
    const el = AppState.elements.get(elementId);
    if (!el) return;

    AppState.mode = 'editing';
    AppState.editingElementId = elementId;

    const group = document.querySelector(`#layer-elements [data-id="${elementId}"]`);
    if (!group) return;

    // Hide the static text
    const textEl = group.querySelector('.shape-text');
    if (textEl) textEl.style.display = 'none';

    // Create foreignObject for editing
    const fo = createSvgElement('foreignObject', {
        x: el.x + 4,
        y: el.y + 4,
        width: el.width - 8,
        height: el.height - 8,
        class: 'edit-foreign-object'
    });

    const input = document.createElement('textarea');
    input.className = 'inline-editor';
    input.value = el.text;
    input.style.fontSize = el.style.fontSize + 'px';
    input.style.color = el.style.textColor;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finishEditing();
        }
        if (e.key === 'Escape') {
            cancelEditing();
        }
        e.stopPropagation(); // Prevent shortcuts while editing
    });

    input.addEventListener('blur', () => {
        // Small delay to allow button clicks to register
        setTimeout(() => {
            if (AppState.mode === 'editing' && AppState.editingElementId === elementId) {
                finishEditing();
            }
        }, 100);
    });

    fo.appendChild(input);
    group.appendChild(fo);

    // Focus and select all text
    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

// Finish editing and save text
export function finishEditing() {
    if (!AppState.editingElementId) return;

    const elementId = AppState.editingElementId;
    const group = document.querySelector(`#layer-elements [data-id="${elementId}"]`);

    if (group) {
        const fo = group.querySelector('.edit-foreign-object');
        if (fo) {
            const input = fo.querySelector('textarea');
            const newText = input ? input.value.trim() : '';
            if (newText !== AppState.elements.get(elementId)?.text) {
                pushHistory('text');
                updateElementText(elementId, newText || 'Text');
            }
            fo.remove();
        }

        // Show static text again
        const textEl = group.querySelector('.shape-text');
        if (textEl) textEl.style.display = '';
    }

    AppState.mode = 'idle';
    AppState.editingElementId = null;
}

// Cancel editing without saving
export function cancelEditing() {
    if (!AppState.editingElementId) return;

    const elementId = AppState.editingElementId;
    const group = document.querySelector(`#layer-elements [data-id="${elementId}"]`);

    if (group) {
        const fo = group.querySelector('.edit-foreign-object');
        if (fo) fo.remove();

        const textEl = group.querySelector('.shape-text');
        if (textEl) textEl.style.display = '';
    }

    AppState.mode = 'idle';
    AppState.editingElementId = null;
}

// Start editing a connection label
export function startEditingConnectionLabel(connId) {
    const conn = AppState.connections.get(connId);
    if (!conn) return;

    const label = prompt('Enter label for this connection:', conn.label || '');
    if (label !== null) {
        pushHistory('connectionLabel');
        updateConnectionLabel(connId, label);
    }
}

// Initialize double-click editing
export function initEditor() {
    const svg = document.getElementById('canvas');

    svg.addEventListener('dblclick', (e) => {
        if (AppState.mode !== 'idle') return;

        const { screenToCanvas } = require_screenToCanvas();
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        // Check if double-clicking an element
        const { getElementAtPosition } = require_getElementAtPosition();
        const element = getElementAtPosition(canvasPos.x, canvasPos.y);

        if (element) {
            startEditing(element.id);
            return;
        }

        // Check if double-clicking a connection label
        const target = e.target;
        if (target.classList.contains('connection-label') || target.closest('.connection-label')) {
            const connId = target.getAttribute('data-conn-id') || target.closest('[data-conn-id]')?.getAttribute('data-conn-id');
            if (connId) {
                startEditingConnectionLabel(connId);
            }
        }
    });
}

// Lazy imports to avoid circular dependencies
function require_screenToCanvas() {
    // We'll resolve this at runtime
    return { screenToCanvas: window.__collabflow_screenToCanvas };
}

function require_getElementAtPosition() {
    return { getElementAtPosition: window.__collabflow_getElementAtPosition };
}

// Update properties panel for selected element(s)
export function updatePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (!panel) return;

    const content = panel.querySelector('.panel-content');
    if (!content) return;

    if (AppState.selection.size === 0) {
        content.innerHTML = '<div class="panel-section"><p style="color: var(--text-tertiary); font-size: 13px;">Select an element to edit its properties.</p></div>';
        return;
    }

    if (AppState.selection.size === 1) {
        const id = [...AppState.selection][0];
        const el = AppState.elements.get(id);
        const conn = AppState.connections.get(id);

        if (el) {
            renderElementProperties(content, el);
        } else if (conn) {
            renderConnectionProperties(content, conn);
        }
    } else {
        content.innerHTML = `<div class="panel-section"><p style="color: var(--text-tertiary); font-size: 13px;">${AppState.selection.size} items selected</p></div>`;
    }
}

function renderElementProperties(container, el) {
    container.innerHTML = `
        <div class="panel-section">
            <div class="panel-section-title">Text</div>
            <div class="prop-row">
                <input type="text" class="prop-input" id="prop-text" value="${escapeHtml(el.text)}" style="width: 100%">
            </div>
        </div>
        <div class="panel-section">
            <div class="panel-section-title">Position</div>
            <div class="prop-row">
                <span class="prop-label">X</span>
                <input type="number" class="prop-input" id="prop-x" value="${Math.round(el.x)}">
                <span class="prop-label">Y</span>
                <input type="number" class="prop-input" id="prop-y" value="${Math.round(el.y)}">
            </div>
            <div class="prop-row">
                <span class="prop-label">W</span>
                <input type="number" class="prop-input" id="prop-w" value="${Math.round(el.width)}">
                <span class="prop-label">H</span>
                <input type="number" class="prop-input" id="prop-h" value="${Math.round(el.height)}">
            </div>
        </div>
        <div class="panel-section">
            <div class="panel-section-title">Style</div>
            <div class="prop-row">
                <span class="prop-label">Fill</span>
                <input type="color" class="prop-input" id="prop-fill" value="${resolveColor(el.style.fill)}">
            </div>
            <div class="prop-row">
                <span class="prop-label">Stroke</span>
                <input type="color" class="prop-input" id="prop-stroke" value="${resolveColor(el.style.stroke)}">
            </div>
            <div class="prop-row">
                <span class="prop-label">Border</span>
                <input type="number" class="prop-input" id="prop-strokeWidth" value="${el.style.strokeWidth}" min="0" max="10">
            </div>
            <div class="prop-row">
                <span class="prop-label">Font</span>
                <input type="number" class="prop-input" id="prop-fontSize" value="${el.style.fontSize}" min="8" max="48">
            </div>
        </div>
    `;

    // Bind events
    const bindInput = (inputId, callback) => {
        const input = container.querySelector(`#${inputId}`);
        if (input) {
            input.addEventListener('change', () => callback(input.value));
            input.addEventListener('input', () => {
                if (input.type === 'color') callback(input.value);
            });
        }
    };

    bindInput('prop-text', (val) => { pushHistory('text'); updateElementText(el.id, val); });
    bindInput('prop-x', (val) => { el.x = parseInt(val); renderElement(el.id); emitStateChange('element:moved', el); });
    bindInput('prop-y', (val) => { el.y = parseInt(val); renderElement(el.id); emitStateChange('element:moved', el); });
    bindInput('prop-w', (val) => { el.width = Math.max(60, parseInt(val)); renderElement(el.id); });
    bindInput('prop-h', (val) => { el.height = Math.max(40, parseInt(val)); renderElement(el.id); });
    bindInput('prop-fill', (val) => { pushHistory('style'); updateElementStyle(el.id, 'fill', val); });
    bindInput('prop-stroke', (val) => { pushHistory('style'); updateElementStyle(el.id, 'stroke', val); });
    bindInput('prop-strokeWidth', (val) => { updateElementStyle(el.id, 'strokeWidth', parseInt(val)); });
    bindInput('prop-fontSize', (val) => { updateElementStyle(el.id, 'fontSize', parseInt(val)); });
}

function renderConnectionProperties(container, conn) {
    container.innerHTML = `
        <div class="panel-section">
            <div class="panel-section-title">Label</div>
            <div class="prop-row">
                <input type="text" class="prop-input" id="prop-conn-label" value="${escapeHtml(conn.label)}" placeholder="Add label..." style="width: 100%">
            </div>
        </div>
        <div class="panel-section">
            <div class="panel-section-title">Style</div>
            <div class="prop-row">
                <span class="prop-label">Color</span>
                <input type="color" class="prop-input" id="prop-conn-stroke" value="${resolveColor(conn.style.stroke)}">
            </div>
            <div class="prop-row">
                <span class="prop-label">Width</span>
                <input type="number" class="prop-input" id="prop-conn-strokeWidth" value="${conn.style.strokeWidth}" min="1" max="8">
            </div>
            <div class="prop-row">
                <span class="prop-label">Dashed</span>
                <input type="checkbox" id="prop-conn-dashed" ${conn.style.strokeDasharray ? 'checked' : ''}>
            </div>
        </div>
    `;

    const bindInput = (inputId, callback) => {
        const input = container.querySelector(`#${inputId}`);
        if (input) {
            input.addEventListener('change', () => callback(input.type === 'checkbox' ? input.checked : input.value));
            input.addEventListener('input', () => {
                if (input.type === 'color') callback(input.value);
            });
        }
    };

    bindInput('prop-conn-label', (val) => { pushHistory('connectionLabel'); updateConnectionLabel(conn.id, val); });
    bindInput('prop-conn-stroke', (val) => { conn.style.stroke = val; renderConnection(conn.id); });
    bindInput('prop-conn-strokeWidth', (val) => { conn.style.strokeWidth = parseInt(val); renderConnection(conn.id); });
    bindInput('prop-conn-dashed', (val) => { conn.style.strokeDasharray = val ? '6, 4' : ''; renderConnection(conn.id); });
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveColor(color) {
    // If it's a CSS variable, return a fallback hex
    if (color.startsWith('var(')) {
        const el = document.createElement('div');
        el.style.color = color;
        document.body.appendChild(el);
        const computed = getComputedStyle(el).color;
        el.remove();
        return rgbToHex(computed);
    }
    if (color === 'none') return '#000000';
    return color;
}

function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/(\d+)/g);
    if (!match) return '#000000';
    const [r, g, b] = match.map(Number);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
