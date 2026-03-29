// CollabFlow - Export functionality (PDF, PNG, JSON)

import AppState from './state.js';
import { deepClone } from './utils.js';
import { renderAllElements } from './elements.js';
import { renderAllConnections } from './connectors.js';
import { showToast } from './collaboration.js';

// Export flowchart as PNG
export async function exportPNG() {
    try {
        const svg = document.getElementById('canvas');
        const clone = svg.cloneNode(true);

        // Remove non-content layers from clone
        const cursors = clone.querySelector('#layer-cursors');
        if (cursors) cursors.innerHTML = '';
        const selection = clone.querySelector('#layer-selection');
        if (selection) selection.innerHTML = '';

        // Calculate bounding box of all elements
        const bbox = getContentBounds();
        if (!bbox) {
            showToast('Nothing to export');
            return;
        }

        const padding = 40;
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Set viewBox to content area
        clone.setAttribute('width', width * 2);
        clone.setAttribute('height', height * 2);
        clone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);

        // Remove viewport transform from clone
        const viewport = clone.querySelector('#viewport-transform');
        if (viewport) viewport.removeAttribute('transform');

        // Inline computed styles for shapes
        inlineStyles(clone);

        // Convert to data URL
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clone);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // Draw to canvas for PNG
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');

            // Fill background
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            // Download
            canvas.toBlob((blob) => {
                downloadBlob(blob, 'flowchart.png');
                showToast('PNG exported');
            }, 'image/png');
        };
        img.src = url;
    } catch (err) {
        console.error('PNG export failed:', err);
        showToast('Export failed');
    }
}

// Export flowchart as PDF
export async function exportPDF() {
    try {
        // Check if jsPDF is loaded
        if (!window.jspdf) {
            showToast('Loading PDF library...');
            await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
        }

        const { jsPDF } = window.jspdf;
        const bbox = getContentBounds();
        if (!bbox) {
            showToast('Nothing to export');
            return;
        }

        const padding = 40;
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Determine orientation
        const orientation = width > height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'px',
            format: [width, height]
        });

        // Render SVG to canvas first
        const svg = document.getElementById('canvas');
        const clone = svg.cloneNode(true);

        const cursors = clone.querySelector('#layer-cursors');
        if (cursors) cursors.innerHTML = '';
        const selection = clone.querySelector('#layer-selection');
        if (selection) selection.innerHTML = '';

        clone.setAttribute('width', width * 2);
        clone.setAttribute('height', height * 2);
        clone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);

        const viewport = clone.querySelector('#viewport-transform');
        if (viewport) viewport.removeAttribute('transform');

        inlineStyles(clone);

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clone);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff'; // White background for PDF
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save('flowchart.pdf');
            showToast('PDF exported');
        };
        img.src = url;
    } catch (err) {
        console.error('PDF export failed:', err);
        showToast('PDF export failed');
    }
}

// Export as JSON
export function exportJSON() {
    const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        elements: Object.fromEntries(AppState.elements),
        connections: Object.fromEntries(AppState.connections)
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'flowchart.json');
    showToast('JSON exported');
}

// Import from JSON
export function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.elements) {
                showToast('Invalid file format');
                return;
            }

            // Clear current state
            AppState.elements.clear();
            AppState.connections.clear();
            AppState.selection.clear();

            // Load elements
            for (const [id, el] of Object.entries(data.elements)) {
                AppState.elements.set(id, el);
            }

            // Load connections
            if (data.connections) {
                for (const [id, conn] of Object.entries(data.connections)) {
                    AppState.connections.set(id, conn);
                }
            }

            renderAllElements();
            renderAllConnections();
            showToast('File loaded');
        } catch (err) {
            console.error('Import failed:', err);
            showToast('Failed to load file');
        }
    };
    reader.readAsText(file);
}

// Get bounding box of all content
function getContentBounds() {
    if (AppState.elements.size === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const el of AppState.elements.values()) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// Inline CSS custom properties into actual values for export
function inlineStyles(svgClone) {
    const computedStyle = getComputedStyle(document.documentElement);

    svgClone.querySelectorAll('[fill], [stroke]').forEach(el => {
        ['fill', 'stroke'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && val.startsWith('var(')) {
                const varName = val.match(/var\((--[^)]+)\)/)?.[1];
                if (varName) {
                    const resolved = computedStyle.getPropertyValue(varName).trim();
                    if (resolved) el.setAttribute(attr, resolved);
                }
            }
        });
    });

    // Also handle fill on text elements
    svgClone.querySelectorAll('text').forEach(el => {
        const fill = el.getAttribute('fill');
        if (fill && fill.startsWith('var(')) {
            const varName = fill.match(/var\((--[^)]+)\)/)?.[1];
            if (varName) {
                const resolved = computedStyle.getPropertyValue(varName).trim();
                if (resolved) el.setAttribute('fill', resolved);
            }
        }
    });

    // Handle grid pattern
    svgClone.querySelectorAll('pattern path').forEach(el => {
        const stroke = el.getAttribute('stroke');
        if (stroke && stroke.startsWith('var(')) {
            el.setAttribute('stroke', 'none'); // Hide grid in export
        }
    });
}

// Helper to download a blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Helper to load a script
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
