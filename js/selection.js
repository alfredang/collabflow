// CollabFlow - Selection management

import AppState, { emitStateChange } from './state.js';
import { createSvgElement, rectsOverlap } from './utils.js';

// Select a single element (clear others unless shift)
export function selectElement(id, additive = false) {
    if (!additive) {
        clearSelection();
    }

    AppState.selection.add(id);
    updateSelectionVisuals();
    showPropertiesPanel();
    emitStateChange('selection:changed', { selected: [...AppState.selection] });
}

// Deselect one element
export function deselectElement(id) {
    AppState.selection.delete(id);
    updateSelectionVisuals();

    if (AppState.selection.size === 0) {
        hidePropertiesPanel();
    }
    emitStateChange('selection:changed', { selected: [...AppState.selection] });
}

// Toggle selection
export function toggleSelection(id) {
    if (AppState.selection.has(id)) {
        deselectElement(id);
    } else {
        selectElement(id, true);
    }
}

// Clear all selection
export function clearSelection() {
    AppState.selection.clear();
    updateSelectionVisuals();
    hidePropertiesPanel();
    emitStateChange('selection:changed', { selected: [] });
}

// Select all elements
export function selectAll() {
    for (const id of AppState.elements.keys()) {
        AppState.selection.add(id);
    }
    updateSelectionVisuals();
    emitStateChange('selection:changed', { selected: [...AppState.selection] });
}

// Select elements within a rectangle (canvas coordinates)
export function selectInRect(rect) {
    for (const [id, el] of AppState.elements) {
        const overlap = rectsOverlap(
            { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            { x: el.x, y: el.y, width: el.width, height: el.height }
        );
        if (overlap) {
            AppState.selection.add(id);
        }
    }
    updateSelectionVisuals();
    if (AppState.selection.size > 0) {
        showPropertiesPanel();
    }
    emitStateChange('selection:changed', { selected: [...AppState.selection] });
}

// Update visual selection indicators on SVG elements
function updateSelectionVisuals() {
    // Update element selection classes
    const elements = document.querySelectorAll('.flowchart-element');
    elements.forEach(el => {
        const id = el.getAttribute('data-id');
        if (AppState.selection.has(id)) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });

    // Update connection selection classes
    const connections = document.querySelectorAll('.connection-path');
    connections.forEach(path => {
        const group = path.closest('[data-conn-id]');
        if (group) {
            const id = group.getAttribute('data-conn-id');
            if (AppState.selection.has(id)) {
                path.classList.add('selected');
            } else {
                path.classList.remove('selected');
            }
        }
    });

    // Render selection handles for single selected element
    renderSelectionHandles();
}

// Render resize handles around selected element(s)
function renderSelectionHandles() {
    const layer = document.getElementById('layer-selection');
    // Remove old handles
    layer.querySelectorAll('.selection-handle, .selection-bounds').forEach(el => el.remove());

    if (AppState.selection.size !== 1) return;

    const id = [...AppState.selection][0];
    const el = AppState.elements.get(id);
    if (!el) return;

    // Bounding box outline
    const bounds = createSvgElement('rect', {
        x: el.x - 1,
        y: el.y - 1,
        width: el.width + 2,
        height: el.height + 2,
        fill: 'none',
        stroke: 'var(--selection-color)',
        'stroke-width': 1,
        'stroke-dasharray': '4, 3',
        class: 'selection-bounds',
        'pointer-events': 'none'
    });
    layer.appendChild(bounds);

    // Corner handles
    const handleSize = 8;
    const positions = [
        { x: el.x, y: el.y, cursor: 'nw-resize', pos: 'nw' },
        { x: el.x + el.width, y: el.y, cursor: 'ne-resize', pos: 'ne' },
        { x: el.x + el.width, y: el.y + el.height, cursor: 'se-resize', pos: 'se' },
        { x: el.x, y: el.y + el.height, cursor: 'sw-resize', pos: 'sw' }
    ];

    for (const p of positions) {
        const handle = createSvgElement('rect', {
            x: p.x - handleSize / 2,
            y: p.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
            class: 'selection-handle',
            'data-handle': p.pos,
            style: `cursor: ${p.cursor}`
        });
        layer.appendChild(handle);
    }
}

// Start rubber band selection
export function startRubberBand(x, y) {
    AppState.rubberBand = { startX: x, startY: y, currentX: x, currentY: y };
    renderRubberBand();
}

// Update rubber band
export function updateRubberBand(x, y) {
    if (!AppState.rubberBand) return;
    AppState.rubberBand.currentX = x;
    AppState.rubberBand.currentY = y;
    renderRubberBand();
}

// End rubber band and select enclosed elements
export function endRubberBand() {
    if (!AppState.rubberBand) return;

    const rb = AppState.rubberBand;
    const rect = {
        x: Math.min(rb.startX, rb.currentX),
        y: Math.min(rb.startY, rb.currentY),
        width: Math.abs(rb.currentX - rb.startX),
        height: Math.abs(rb.currentY - rb.startY)
    };

    if (rect.width > 5 || rect.height > 5) {
        selectInRect(rect);
    }

    // Remove rubber band visual
    const layer = document.getElementById('layer-selection');
    const rbRect = layer.querySelector('.rubber-band');
    if (rbRect) rbRect.remove();

    AppState.rubberBand = null;
}

function renderRubberBand() {
    const layer = document.getElementById('layer-selection');
    let rbRect = layer.querySelector('.rubber-band');

    if (!rbRect) {
        rbRect = createSvgElement('rect', { class: 'rubber-band' });
        layer.appendChild(rbRect);
    }

    const rb = AppState.rubberBand;
    rbRect.setAttribute('x', Math.min(rb.startX, rb.currentX));
    rbRect.setAttribute('y', Math.min(rb.startY, rb.currentY));
    rbRect.setAttribute('width', Math.abs(rb.currentX - rb.startX));
    rbRect.setAttribute('height', Math.abs(rb.currentY - rb.startY));
}

// Show properties panel
function showPropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) panel.classList.add('visible');
}

// Hide properties panel
function hidePropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    if (panel) panel.classList.remove('visible');
}

// Get selected elements data
export function getSelectedElements() {
    const elements = [];
    for (const id of AppState.selection) {
        const el = AppState.elements.get(id);
        if (el) elements.push(el);
    }
    return elements;
}

// Get selected connections data
export function getSelectedConnections() {
    const connections = [];
    for (const id of AppState.selection) {
        const conn = AppState.connections.get(id);
        if (conn) connections.push(conn);
    }
    return connections;
}
