// CollabFlow - Connection/arrow routing and rendering

import AppState, { emitStateChange } from './state.js';
import { generateId, createSvgElement, getPortPositions, bestPorts } from './utils.js';

// Create a new connection data object
export function createConnection(fromElementId, fromPort, toElementId, toPort) {
    return {
        id: generateId('conn'),
        fromElementId,
        fromPort,
        toElementId,
        toPort,
        label: '',
        style: {
            stroke: 'var(--shape-stroke)',
            strokeWidth: 2,
            strokeDasharray: ''
        }
    };
}

// Add connection to state and render
export function addConnection(conn) {
    AppState.connections.set(conn.id, conn);
    renderConnection(conn.id);
    emitStateChange('connection:added', conn);
    return conn;
}

// Remove connection
export function removeConnection(id) {
    const conn = AppState.connections.get(id);
    if (!conn) return;

    const layer = document.getElementById('layer-connections');
    const group = layer.querySelector(`[data-conn-id="${id}"]`);
    if (group) group.remove();

    AppState.connections.delete(id);
    emitStateChange('connection:removed', { id });
}

// Remove all connections for an element
export function removeConnectionsForElement(elementId) {
    const toRemove = [];
    for (const [id, conn] of AppState.connections) {
        if (conn.fromElementId === elementId || conn.toElementId === elementId) {
            toRemove.push(id);
        }
    }
    toRemove.forEach(id => removeConnection(id));
}

// Compute orthogonal path waypoints
function computePath(fromPos, fromPort, toPos, toPort) {
    const sx = fromPos.x;
    const sy = fromPos.y;
    const tx = toPos.x;
    const ty = toPos.y;
    const margin = 30;

    let waypoints = [];

    // Direction-aware routing
    if (fromPort === 'bottom' && toPort === 'top') {
        const midY = (sy + ty) / 2;
        if (ty > sy + margin) {
            waypoints = [{ x: sx, y: midY }, { x: tx, y: midY }];
        } else {
            // Target is above or close: route around
            const detourX = Math.max(sx, tx) + margin * 2;
            waypoints = [
                { x: sx, y: sy + margin },
                { x: detourX, y: sy + margin },
                { x: detourX, y: ty - margin },
                { x: tx, y: ty - margin }
            ];
        }
    } else if (fromPort === 'top' && toPort === 'bottom') {
        const midY = (sy + ty) / 2;
        if (ty < sy - margin) {
            waypoints = [{ x: sx, y: midY }, { x: tx, y: midY }];
        } else {
            const detourX = Math.max(sx, tx) + margin * 2;
            waypoints = [
                { x: sx, y: sy - margin },
                { x: detourX, y: sy - margin },
                { x: detourX, y: ty + margin },
                { x: tx, y: ty + margin }
            ];
        }
    } else if (fromPort === 'right' && toPort === 'left') {
        const midX = (sx + tx) / 2;
        if (tx > sx + margin) {
            waypoints = [{ x: midX, y: sy }, { x: midX, y: ty }];
        } else {
            const detourY = Math.max(sy, ty) + margin * 2;
            waypoints = [
                { x: sx + margin, y: sy },
                { x: sx + margin, y: detourY },
                { x: tx - margin, y: detourY },
                { x: tx - margin, y: ty }
            ];
        }
    } else if (fromPort === 'left' && toPort === 'right') {
        const midX = (sx + tx) / 2;
        if (tx < sx - margin) {
            waypoints = [{ x: midX, y: sy }, { x: midX, y: ty }];
        } else {
            const detourY = Math.max(sy, ty) + margin * 2;
            waypoints = [
                { x: sx - margin, y: sy },
                { x: sx - margin, y: detourY },
                { x: tx + margin, y: detourY },
                { x: tx + margin, y: ty }
            ];
        }
    } else {
        // Fallback: simple L-shaped route
        if (fromPort === 'bottom' || fromPort === 'top') {
            waypoints = [{ x: sx, y: ty }];
        } else {
            waypoints = [{ x: tx, y: sy }];
        }
    }

    return waypoints;
}

// Build SVG path d attribute from waypoints
function buildPathD(fromPos, waypoints, toPos) {
    let d = `M ${fromPos.x} ${fromPos.y}`;
    for (const wp of waypoints) {
        d += ` L ${wp.x} ${wp.y}`;
    }
    d += ` L ${toPos.x} ${toPos.y}`;
    return d;
}

// Render or update a connection
export function renderConnection(id) {
    const conn = AppState.connections.get(id);
    const layer = document.getElementById('layer-connections');

    if (!conn) {
        const existing = layer.querySelector(`[data-conn-id="${id}"]`);
        if (existing) existing.remove();
        return;
    }

    const fromEl = AppState.elements.get(conn.fromElementId);
    const toEl = AppState.elements.get(conn.toElementId);
    if (!fromEl || !toEl) return;

    const fromPorts = getPortPositions(fromEl);
    const toPorts = getPortPositions(toEl);
    const fromPos = fromPorts[conn.fromPort];
    const toPos = toPorts[conn.toPort];

    if (!fromPos || !toPos) return;

    const waypoints = computePath(fromPos, conn.fromPort, toPos, conn.toPort);
    const d = buildPathD(fromPos, waypoints, toPos);

    let group = layer.querySelector(`[data-conn-id="${id}"]`);
    const isNew = !group;

    if (isNew) {
        group = createSvgElement('g', { 'data-conn-id': id });
        layer.appendChild(group);
    } else {
        group.innerHTML = '';
    }

    // Hit area (wider invisible path for easier clicking)
    const hitPath = createSvgElement('path', {
        d,
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 12,
        class: 'connection-hit',
        'data-conn-id': id
    });
    group.appendChild(hitPath);

    // Visible path
    const path = createSvgElement('path', {
        d,
        fill: 'none',
        stroke: conn.style.stroke,
        'stroke-width': conn.style.strokeWidth,
        'stroke-dasharray': conn.style.strokeDasharray || '',
        'marker-end': 'url(#arrowhead)',
        class: 'connection-path'
    });

    if (AppState.selection.has(id)) {
        path.classList.add('selected');
    }

    group.appendChild(path);

    // Label
    if (conn.label) {
        const allPoints = [fromPos, ...waypoints, toPos];
        const midIdx = Math.floor(allPoints.length / 2);
        const labelPos = allPoints[midIdx] || { x: (fromPos.x + toPos.x) / 2, y: (fromPos.y + toPos.y) / 2 };

        // Label background
        const labelBg = createSvgElement('rect', {
            x: labelPos.x - 20,
            y: labelPos.y - 10,
            width: 40,
            height: 20,
            class: 'connection-label-bg'
        });
        group.appendChild(labelBg);

        const label = createSvgElement('text', {
            x: labelPos.x,
            y: labelPos.y,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            class: 'connection-label',
            'data-conn-id': id
        });
        label.textContent = conn.label;
        group.appendChild(label);

        // Size the background to the text
        requestAnimationFrame(() => {
            const bbox = label.getBBox();
            labelBg.setAttribute('x', bbox.x - 4);
            labelBg.setAttribute('y', bbox.y - 2);
            labelBg.setAttribute('width', bbox.width + 8);
            labelBg.setAttribute('height', bbox.height + 4);
        });
    }
}

// Render all connections
export function renderAllConnections() {
    const layer = document.getElementById('layer-connections');
    layer.innerHTML = '';
    for (const id of AppState.connections.keys()) {
        renderConnection(id);
    }
}

// Update connections when an element moves
export function updateConnectionsForElement(elementId) {
    for (const [id, conn] of AppState.connections) {
        if (conn.fromElementId === elementId || conn.toElementId === elementId) {
            renderConnection(id);
        }
    }
}

// Render temporary connection line while dragging
export function renderTempConnection(fromPos, toPos) {
    let tempLine = document.getElementById('temp-connection');
    if (!tempLine) {
        tempLine = createSvgElement('path', {
            id: 'temp-connection',
            class: 'temp-connection',
            'marker-end': 'url(#arrowhead-temp)'
        });
        document.getElementById('layer-selection').appendChild(tempLine);
    }
    tempLine.setAttribute('d', `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`);
    tempLine.style.display = '';
}

// Hide temporary connection line
export function hideTempConnection() {
    const tempLine = document.getElementById('temp-connection');
    if (tempLine) {
        tempLine.style.display = 'none';
    }
}

// Update connection label
export function updateConnectionLabel(id, label) {
    const conn = AppState.connections.get(id);
    if (!conn) return;
    conn.label = label;
    renderConnection(id);
    emitStateChange('connection:labelChanged', { id, label });
}

// Get connection at canvas position (check hit areas)
export function getConnectionAtPosition(canvasX, canvasY) {
    const layer = document.getElementById('layer-connections');
    // Use SVG hit testing
    const point = document.getElementById('canvas').createSVGPoint();
    point.x = canvasX;
    point.y = canvasY;

    for (const [id, conn] of AppState.connections) {
        const hitPath = layer.querySelector(`.connection-hit[data-conn-id="${id}"]`);
        if (hitPath && hitPath.isPointInStroke(point)) {
            return conn;
        }
    }
    return null;
}
