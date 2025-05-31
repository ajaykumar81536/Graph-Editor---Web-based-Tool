// Get the canvas element and its 2D drawing context for rendering the graph
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
// Reference to the output panel for displaying graph stats and algorithm logs
const outputBody = document.getElementById('bottomOutputBody');

// Set canvas dimensions to match its visible size
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// Arrays to store graph nodes and edges
let nodes = [];
let edges = [];
// Graph properties and modes
let isDirected = false; // Whether the graph is directed or undirected
let edgeMode = false; // Mode for adding edges
let deleteMode = false; // Mode for deleting nodes or edges
let selectedNodes = []; // Nodes selected for creating an edge
let undoStack = []; // Stack to store actions for undo functionality
// Algorithm visualization variables
let algorithmSteps = []; // Steps of the algorithm for visualization
let stepDescriptions = []; // Descriptions for each algorithm step
let currentStepIndex = -1; // Current step in the algorithm visualization
let currentAlgorithm = null; // The currently selected algorithm (e.g., BFS, DFS)
let startNodeId = null; // Starting node for algorithms
// Node dragging variables
let draggedNode = null; // Node currently being dragged
let isDragging = false; // Whether a node is being dragged
let dragStartX, dragStartY; // Starting coordinates of a drag
// Edge preview while adding an edge
let edgePreview = null; // Preview of an edge being created
// Gradients for visual styling
let nodeGradient, edgeGradient, shortestPathGradient, startNodeGradient;
// Animation settings
let animationSpeed = 500; // Speed of algorithm visualization (in milliseconds)
let algorithmCompleted = false; // Whether the algorithm has finished running
let animationFrameId = null; // ID for animation frame (for pausing/stopping)
let needsRedraw = true; // Flag to indicate if the canvas needs to be redrawn
// Visualization state for algorithm highlighting
let visualizationState = { 
    highlightedNodes: new Set(), // Nodes highlighted during algorithm
    highlightedEdges: new Set(), // Edges highlighted during algorithm
    shortestPathEdges: new Set(), // Edges part of the shortest path
    finalDistances: null, // Final distances computed by algorithms
    finalPrevious: null // Previous nodes in shortest paths
};
let isPaused = false; // Whether the algorithm visualization is paused
let redrawScheduled = false; // Prevents multiple redraws from being scheduled

// Debounce function to limit the rate of function calls (e.g., for speed slider)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize color gradients for nodes, edges, shortest paths, and start node
function initGradients() {
    nodeGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    nodeGradient.addColorStop(0, '#00f7ff');
    nodeGradient.addColorStop(1, '#00ff80');
    edgeGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    edgeGradient.addColorStop(0, '#ff00ff');
    edgeGradient.addColorStop(1, '#ff9100');
    shortestPathGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    shortestPathGradient.addColorStop(0, '#ff9100');
    shortestPathGradient.addColorStop(1, '#ff2a00');
    startNodeGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    startNodeGradient.addColorStop(0, '#ffea00');
    startNodeGradient.addColorStop(1, '#ff9100');
}
initGradients();

// Add event listeners for toolbar buttons (desktop and mobile)
document.getElementById('addNodeBtn').addEventListener('click', addNode);
document.getElementById('mobileAddNodeBtn').addEventListener('click', addNode);
document.getElementById('addEdgeBtn').addEventListener('click', toggleEdgeMode);
document.getElementById('mobileAddEdgeBtn').addEventListener('click', toggleEdgeMode);
document.getElementById('deleteBtn').addEventListener('click', toggleDeleteMode);
document.getElementById('mobileDeleteBtn').addEventListener('click', toggleDeleteMode);
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('mobileUndoBtn').addEventListener('click', undo);
document.getElementById('toggleDirectedBtn').addEventListener('click', toggleDirected);
document.getElementById('mobileToggleDirectedBtn').addEventListener('click', toggleDirected);
document.getElementById('bfsBtn').addEventListener('click', () => showStartNodeModal('bfs'));
document.getElementById('mobileBfsBtn').addEventListener('click', () => showStartNodeModal('bfs'));
document.getElementById('dfsBtn').addEventListener('click', () => showStartNodeModal('dfs'));
document.getElementById('mobileDfsBtn').addEventListener('click', () => showStartNodeModal('dfs'));
document.getElementById('dijkstraBtn').addEventListener('click', () => showStartNodeModal('dijkstra'));
document.getElementById('mobileDijkstraBtn').addEventListener('click', () => showStartNodeModal('dijkstra'));
document.getElementById('bellmanFordBtn').addEventListener('click', () => showStartNodeModal('bellman-ford'));
document.getElementById('mobileBellmanFordBtn').addEventListener('click', () => showStartNodeModal('bellman-ford'));
document.getElementById('runBtn').addEventListener('click', runAlgorithm);
document.getElementById('mobileRunBtn').addEventListener('click', runAlgorithm);
document.getElementById('stepBtn').addEventListener('click', stepThrough);
document.getElementById('mobileStepBtn').addEventListener('click', stepThrough);
document.getElementById('saveBtn').addEventListener('click', saveGraph);
document.getElementById('mobileSaveBtn').addEventListener('click', saveGraph);
document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('loadFileInput').click());
document.getElementById('mobileLoadBtn').addEventListener('click', () => document.getElementById('loadFileInput').click());
document.getElementById('loadFileInput').addEventListener('change', loadGraph);
document.getElementById('resetBtn').addEventListener('click', resetCanvas);
document.getElementById('mobileResetBtn').addEventListener('click', resetCanvas);
document.getElementById('toggleOutputBtn').addEventListener('click', toggleOutput);
document.getElementById('clearOutputBtn').addEventListener('click', () => {
    outputBody.innerHTML = getStatsHTML();
});
document.getElementById('saveEdgeWeightBtn').addEventListener('click', saveEdgeWeight);
document.getElementById('saveStartNodeBtn').addEventListener('click', saveStartNode);

// Pause and resume buttons for algorithm visualization
document.getElementById('pauseBtn')?.addEventListener('click', () => {
    isPaused = true;
    outputBody.innerHTML = `
        <div class="alert alert-info">Animation paused. Click Resume to continue.</div>
        ${getStatsHTML()}
    `;
});
document.getElementById('resumeBtn')?.addEventListener('click', () => {
    isPaused = false;
    if (animationFrameId) {
        animateSteps();
    }
    outputBody.innerHTML = `
        <div class="alert alert-success">Animation resumed.</div>
        ${getStatsHTML()}
    `;
});

// Speed slider for controlling algorithm animation speed
const speedSlider = document.getElementById('speedSlider');
const mobileSpeedSlider = document.getElementById('mobileSpeedSlider');
speedSlider.min = 100;
speedSlider.max = 5000;
mobileSpeedSlider.min = 100;
mobileSpeedSlider.max = 5000;
const updateSpeed = debounce((value) => {
    animationSpeed = parseInt(value);
}, 100);
speedSlider.addEventListener('input', (e) => updateSpeed(e.target.value));
mobileSpeedSlider.addEventListener('input', (e) => updateSpeed(e.target.value));

// Canvas event listeners for mouse and keyboard interactions
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('click', handleCanvasClick);
document.addEventListener('keydown', handleKeyDown);

// Resize event to adjust canvas size and gradients
window.addEventListener('resize', () => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    initGradients();
    needsRedraw = true;
    scheduleRedraw();
});

// Schedule a redraw of the canvas to avoid multiple overlapping redraws
function scheduleRedraw() {
    if (!redrawScheduled) {
        redrawScheduled = true;
        requestAnimationFrame(() => {
            drawGraph();
            redrawScheduled = false;
        });
    }
}

// Add a new node to the graph at a calculated position
function addNode() {
    const x = canvas.width / 2 + (nodes.length * 50) % 200 - 100;
    const y = canvas.height / 2 + (nodes.length * 50) % 200 - 100;
    const newNodeId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    const node = {
        id: newNodeId,
        x: Math.max(25, Math.min(canvas.width - 25, x)),
        y: Math.max(25, Math.min(canvas.height - 25, y)),
        radius: 20,
        isHighlighted: false,
        isStart: false,
        isDragging: true,
    };
    nodes.push(node);
    draggedNode = node;
    dragStartX = node.x;
    dragStartY = node.y;
    isDragging = true;
    canvas.classList.add('dragging');
    undoStack.push({ action: 'addNode', node });
    updateStats();
    needsRedraw = true;
    scheduleRedraw();
}

// Toggle edge-adding mode
function toggleEdgeMode() {
    edgeMode = !edgeMode;
    deleteMode = false;
    selectedNodes = [];
    edgePreview = null;

    const addEdgeBtn = document.getElementById('addEdgeBtn');
    const mobileAddEdgeBtn = document.getElementById('mobileAddEdgeBtn');
    addEdgeBtn.textContent = edgeMode ? 'Cancel Edge' : 'Add Edge';
    mobileAddEdgeBtn.innerHTML = edgeMode ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-link"></i>';
    addEdgeBtn.classList.toggle('btn-danger', edgeMode);
    addEdgeBtn.classList.toggle('btn-primary', !edgeMode);
    mobileAddEdgeBtn.classList.toggle('btn-danger', edgeMode);
    mobileAddEdgeBtn.classList.toggle('btn-primary', !edgeMode);
    canvas.classList.toggle('edge-mode', edgeMode);
    canvas.classList.remove('delete-mode');

    const deleteBtn = document.getElementById('deleteBtn');
    const mobileDeleteBtn = document.getElementById('mobileDeleteBtn');
    deleteBtn.textContent = 'Delete';
    mobileDeleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.classList.remove('btn-danger');
    deleteBtn.classList.add('btn-primary');
    mobileDeleteBtn.classList.remove('btn-danger');
    mobileDeleteBtn.classList.add('btn-primary');

    needsRedraw = true;
    scheduleRedraw();
}

// Toggle delete mode for removing nodes or edges
function toggleDeleteMode() {
    deleteMode = !deleteMode;
    edgeMode = false;
    selectedNodes = [];
    edgePreview = null;

    const deleteBtn = document.getElementById('deleteBtn');
    const mobileDeleteBtn = document.getElementById('mobileDeleteBtn');
    deleteBtn.textContent = deleteMode ? 'Cancel Delete' : 'Delete';
    mobileDeleteBtn.innerHTML = deleteMode ? '<i class="bi bi-x-circle"></i>' : '<i class="bi bi-trash"></i>';
    deleteBtn.classList.toggle('btn-danger', deleteMode);
    deleteBtn.classList.toggle('btn-primary', !deleteMode);
    mobileDeleteBtn.classList.toggle('btn-danger', deleteMode);
    mobileDeleteBtn.classList.toggle('btn-primary', !deleteMode);
    canvas.classList.toggle('delete-mode', deleteMode);
    canvas.classList.remove('edge-mode');

    const addEdgeBtn = document.getElementById('addEdgeBtn');
    const mobileAddEdgeBtn = document.getElementById('mobileAddEdgeBtn');
    addEdgeBtn.textContent = 'Add Edge';
    mobileAddEdgeBtn.innerHTML = '<i class="bi bi-link"></i>';
    addEdgeBtn.classList.remove('btn-danger');
    addEdgeBtn.classList.add('btn-primary');
    mobileAddEdgeBtn.classList.remove('btn-danger');
    mobileAddEdgeBtn.classList.add('btn-primary');

    needsRedraw = true;
    scheduleRedraw();
}

// Handle mouse down events for dragging nodes or selecting nodes for edges
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = nodes.find(n => Math.hypot(n.x - x, n.y - y) < n.radius);

    if (edgeMode && node) {
        if (selectedNodes.length === 0) {
            selectedNodes = [node];
            node.isHighlighted = true;
            edgePreview = { from: node, x, y };
        } else if (selectedNodes[0] === node) {
            selectedNodes.push(node);
            showEdgeWeightModal();
        } else if (selectedNodes[0] !== node) {
            selectedNodes.push(node);
            node.isHighlighted = true;
            showEdgeWeightModal();
        }
    } else if (node && !edgeMode && !deleteMode) {
        draggedNode = node;
        dragStartX = node.x;
        dragStartY = node.y;
        isDragging = true;
        node.isDragging = true;
        canvas.classList.add('dragging');
    }
    needsRedraw = true;
    scheduleRedraw();
}

// Handle mouse movement for dragging nodes or updating edge preview
function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && draggedNode) {
        draggedNode.x = Math.max(draggedNode.radius, Math.min(canvas.width - draggedNode.radius, x));
        draggedNode.y = Math.max(draggedNode.radius, Math.min(canvas.height - draggedNode.radius, y));
        needsRedraw = true;
        scheduleRedraw();
    } else if (edgeMode && edgePreview && selectedNodes.length === 1) {
        edgePreview.x = x;
        edgePreview.y = y;
        needsRedraw = true;
        scheduleRedraw();
    }
}

// Handle mouse up events to finish dragging or edge creation
function handleMouseUp(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const targetNode = nodes.find(n => Math.hypot(n.x - x, n.y - y) < n.radius);

    if (edgeMode && selectedNodes.length === 1 && targetNode && targetNode !== selectedNodes[0]) {
        selectedNodes.push(targetNode);
        targetNode.isHighlighted = true;
        showEdgeWeightModal();
    } else if (edgeMode && selectedNodes.length === 1 && !targetNode) {
        selectedNodes[0].isHighlighted = false;
        selectedNodes = [];
        edgePreview = null;
    }

    if (isDragging && draggedNode) {
        if (draggedNode.x !== dragStartX || draggedNode.y !== dragStartY) {
            undoStack.push({
                action: 'moveNode',
                nodeId: draggedNode.id,
                oldX: dragStartX,
                oldY: dragStartY,
                newX: draggedNode.x,
                newY: draggedNode.y
            });
        }
        draggedNode.isDragging = false;
        draggedNode = null;
        isDragging = false;
        canvas.classList.remove('dragging');
    }
    needsRedraw = true;
    scheduleRedraw();
}

// Handle canvas clicks in delete mode to remove nodes or edges
function handleCanvasClick(e) {
    if (!deleteMode) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeToDelete = nodes.find(n => Math.hypot(n.x - x, n.y - y) < n.radius);
    if (nodeToDelete) {
        const nodeIndex = nodes.findIndex(n => n.id === nodeToDelete.id);
        const removedNode = nodes.splice(nodeIndex, 1)[0];
        const removedEdges = edges.filter(edge => edge.from === removedNode.id || edge.to === removedNode.id);
        edges = edges.filter(edge => edge.from !== removedNode.id && edge.to !== removedNode.id);
        if (startNodeId === removedNode.id) startNodeId = null;
        undoStack.push({ action: 'deleteNode', node: removedNode, removedEdges });
        updateStats();
        needsRedraw = true;
        scheduleRedraw();
        return;
    }

    const clickedEdge = edges.find(edge => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (!fromNode || !toNode || edge.from === edge.to) return false;

        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        if (dx === 0 && dy === 0) return false;

        const t = ((x - fromNode.x) * dx + (y - fromNode.y) * dy) / (dx * dx + dy * dy);
        let closestX, closestY;
        if (t < 0) {
            closestX = fromNode.x;
            closestY = fromNode.y;
        } else if (t > 1) {
            closestX = toNode.x;
            closestY = toNode.y;
        } else {
            closestX = fromNode.x + t * dx;
            closestY = fromNode.y + t * dy;
        }
        const dist = Math.hypot(x - closestX, y - closestY);
        return dist < 5;
    });

    if (clickedEdge) {
        const edgeIndex = edges.findIndex(e => e.from === clickedEdge.from && e.to === clickedEdge.to && e.weight === clickedEdge.weight);
        if (edgeIndex > -1) {
            const removedEdge = edges.splice(edgeIndex, 1)[0];
            undoStack.push({ action: 'deleteEdge', edge: removedEdge });
            updateStats();
            needsRedraw = true;
            scheduleRedraw();
        }
    }
}

// Handle keyboard events (e.g., Escape key to cancel modes or modals)
function handleKeyDown(e) {
    if (e.key === 'Escape') {
        if (edgeMode) {
            selectedNodes.forEach(n => n.isHighlighted = false);
            selectedNodes = [];
            edgePreview = null;
            toggleEdgeMode();
        } else if (deleteMode) {
            toggleDeleteMode();
        }
        const edgeWeightModalElement = document.getElementById('edgeWeightModal');
        if (edgeWeightModalElement) {
            const edgeWeightModalInstance = bootstrap.Modal.getInstance(edgeWeightModalElement);
            edgeWeightModalInstance?.hide();
        }
        const startNodeModalElement = document.getElementById('startNodeModal');
        if (startNodeModalElement) {
            const startNodeModalInstance = bootstrap.Modal.getInstance(startNodeModalElement);
            startNodeModalInstance?.hide();
        }
        needsRedraw = true;
        scheduleRedraw();
    }
}

// Show modal to input edge weight when creating an edge
function showEdgeWeightModal() {
    const modalElement = document.getElementById('edgeWeightModal');
    if (!modalElement) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    document.getElementById('edgeWeightInput').value = 1;
    modal.show();
}

// Show modal to select start node for an algorithm
function showStartNodeModal(algorithm) {
    currentAlgorithm = algorithm;
    algorithmSteps = [];
    stepDescriptions = [];
    currentStepIndex = -1;
    algorithmCompleted = false;
    isPaused = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    visualizationState = { highlightedNodes: new Set(), highlightedEdges: new Set(), shortestPathEdges: new Set(), finalDistances: null, finalPrevious: null };
    nodes.forEach(n => { n.isHighlighted = false; n.isStart = false; });
    edges.forEach(e => { e.isHighlighted = false; e.isShortestPath = false; });

    const modalElement = document.getElementById('startNodeModal');
    if (!modalElement) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    document.getElementById('startNodeInput').value = '';
    modal.show();
    document.getElementById('runBtn').disabled = true;
    document.getElementById('stepBtn').disabled = true;
    document.getElementById('mobileRunBtn').disabled = true;
    document.getElementById('mobileStepBtn').disabled = true;
    speedSlider.disabled = true;
    mobileSpeedSlider.disabled = true;
    needsRedraw = true;
    scheduleRedraw();
}

// Save the edge weight and create the edge between selected nodes
function saveEdgeWeight() {
    const weightInput = document.getElementById('edgeWeightInput').value;
    const weight = parseFloat(weightInput);

    if (isNaN(weight) || weightInput.trim() === "") {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Invalid edge weight. Please enter a number.</div>
            ${getStatsHTML()}
        `;
        return;
    }

    if (selectedNodes.length < 2) {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Not enough nodes selected to form an edge.</div>
            ${getStatsHTML()}
        `;
        selectedNodes.forEach(n => n.isHighlighted = false);
        selectedNodes = [];
        edgePreview = null;
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('edgeWeightModal'));
        modalInstance?.hide();
        needsRedraw = true;
        scheduleRedraw();
        return;
    }

    const fromNode = selectedNodes[0];
    const toNode = selectedNodes[1];

    const existingEdge = edges.some(e =>
        (e.from === fromNode.id && e.to === toNode.id) ||
        (!isDirected && e.from === toNode.id && e.to === fromNode.id)
    );
    if (existingEdge && fromNode.id !== toNode.id) {
        outputBody.innerHTML = `
            <div class="alert alert-warning">An edge between these nodes already exists.</div>
            ${getStatsHTML()}
        `;
    } else {
        const edge = { from: fromNode.id, to: toNode.id, weight, isHighlighted: false, isShortestPath: false, isNew: true };
        edges.push(edge);
        undoStack.push({ action: 'addEdge', edge });
        setTimeout(() => { edge.isNew = false; needsRedraw = true; scheduleRedraw(); }, 1000);
        updateStats();
    }

    selectedNodes.forEach(n => n.isHighlighted = false);
    selectedNodes = [];
    edgePreview = null;
    needsRedraw = true;
    scheduleRedraw();
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('edgeWeightModal'));
    modalInstance?.hide();
}

// Save the selected start node for the algorithm
function saveStartNode() {
    const startNodeInputVal = document.getElementById('startNodeInput').value;
    if (startNodeInputVal.trim() === "") {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Please enter a start node ID.</div>
            ${getStatsHTML()}
        `;
        return;
    }
    const startNodeInput = parseInt(startNodeInputVal);

    if (isNaN(startNodeInput) || !nodes.some(n => n.id === startNodeInput)) {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Invalid start node ID. Please enter a valid node ID that exists in the graph.</div>
            ${getStatsHTML()}
        `;
        return;
    }
    startNodeId = startNodeInput;
    nodes.forEach(n => n.isStart = (n.id === startNodeId));

    document.getElementById('runBtn').disabled = false;
    document.getElementById('stepBtn').disabled = false;
    document.getElementById('mobileRunBtn').disabled = false;
    document.getElementById('mobileStepBtn').disabled = false;
    speedSlider.disabled = false;
    mobileSpeedSlider.disabled = false;

    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('startNodeModal'));
    modalInstance?.hide();
    needsRedraw = true;
    scheduleRedraw();
}

// Undo the last action (e.g., node/edge addition, deletion, or movement)
function undo() {
    const action = undoStack.pop();
    if (!action) {
        outputBody.innerHTML = `
            <div class="alert alert-warning">Nothing to undo.</div>
            ${getStatsHTML()}
        `;
        return;
    }
    if (action.action === 'addNode') {
        nodes = nodes.filter(n => n.id !== action.node.id);
        if (startNodeId === action.node.id) startNodeId = null;
    } else if (action.action === 'addEdge') {
        const edgeIndex = edges.findIndex(e => e.from === action.edge.from && e.to === action.edge.to && e.weight === action.edge.weight);
        if (edgeIndex > -1) edges.splice(edgeIndex, 1);
    } else if (action.action === 'deleteNode') {
        nodes.push(action.node);
        action.removedEdges.forEach(e => edges.push(e));
        nodes.sort((a,b) => a.id - b.id);
    } else if (action.action === 'moveNode') {
        const node = nodes.find(n => n.id === action.nodeId);
        if (node) {
            node.x = action.oldX;
            node.y = action.oldY;
        }
    } else if (action.action === 'deleteEdge') {
        edges.push(action.edge);
    }
    updateStats();
    needsRedraw = true;
    scheduleRedraw();
}

// Toggle between directed and undirected graph modes
function toggleDirected() {
    isDirected = !isDirected;
    document.getElementById('toggleDirectedBtn').innerHTML = isDirected ? '<i class="bi bi-arrow-right"></i> Undirected' : '<i class="bi bi-arrows-angle-contract"></i> Directed';
    document.getElementById('mobileToggleDirectedBtn').innerHTML = isDirected ? '<i class="bi bi-arrow-right"></i>' : '<i class="bi bi-arrows-angle-contract"></i>';
    updateStats();
    needsRedraw = true;
    scheduleRedraw();
}

// Draw an arrowhead for directed edges
function drawArrowhead(x1, y1, x2, y2, size, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headlen = size;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// Draw the graph, including nodes, edges, and edge previews
function drawGraph() {
    if (!needsRedraw && !isDragging && !(edgeMode && edgePreview)) return;
    needsRedraw = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (edgeMode && edgePreview && selectedNodes.length === 1) {
        const from = edgePreview.from;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(edgePreview.x, edgePreview.y);
        ctx.strokeStyle = edgeGradient;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isDirected) {
            drawArrowhead(from.x, from.y, edgePreview.x, edgePreview.y, 10, edgeGradient);
        }
    }

    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    edges.forEach(edge => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) {
            console.warn(`Invalid edge detected (from: ${edge.from}, to: ${edge.to}). Skipping.`);
            return;
        }

        const strokeColor = edge.isShortestPath ? shortestPathGradient : (edge.isHighlighted ? edgeGradient : '#bdc1c6');
        const lineWidth = edge.isHighlighted || edge.isShortestPath ? 4 : 2;
        const isNewVisual = edge.isNew || false;

        if (edge.from === edge.to) {
            ctx.save();
            ctx.translate(fromNode.x, fromNode.y);
            const loopRadius = fromNode.radius * 0.8;
            const loopOffsetAngle = -Math.PI / 2;

            ctx.beginPath();
            ctx.arc(loopRadius * Math.cos(loopOffsetAngle), loopRadius * Math.sin(loopOffsetAngle) - fromNode.radius*0.5, loopRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = isNewVisual ? edgeGradient : strokeColor;
            ctx.lineWidth = lineWidth;
            if (edge.isHighlighted || edge.isShortestPath) {
                ctx.shadowBlur = 5;
                ctx.shadowColor = strokeColor === shortestPathGradient ? '#ff2a00' : '#00f7ff';
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (isDirected) {
                const arrowAngle = loopOffsetAngle + Math.PI * 1.5;
                const arrowAttachX = (loopRadius * Math.cos(loopOffsetAngle)) + loopRadius * Math.cos(arrowAngle);
                const arrowAttachY = (loopRadius * Math.sin(loopOffsetAngle) - fromNode.radius*0.5) + loopRadius * Math.sin(arrowAngle);
                const tangentAngle = arrowAngle + Math.PI / 2;
                drawArrowhead(
                    arrowAttachX - Math.cos(tangentAngle),
                    arrowAttachY - Math.sin(tangentAngle),
                    arrowAttachX,
                    arrowAttachY,
                    10,
                    strokeColor
                );
            }
            ctx.restore();

            ctx.fillStyle = '#e0e0e0';
            ctx.font = '12px Poppins';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(edge.weight.toString(), fromNode.x + loopRadius * Math.cos(loopOffsetAngle), fromNode.y + loopRadius * Math.sin(loopOffsetAngle) - fromNode.radius*0.5 - loopRadius - 10);
        } else {
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            ctx.strokeStyle = isNewVisual ? edgeGradient : strokeColor;
            ctx.lineWidth = lineWidth;
            if (edge.isHighlighted || edge.isShortestPath) {
                ctx.shadowBlur = 5;
                ctx.shadowColor = strokeColor === shortestPathGradient ? '#ff2a00' : '#00f7ff';
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (isDirected) {
                const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
                const offset = toNode.radius;
                const arrowX = toNode.x - offset * Math.cos(angle);
                const arrowY = toNode.y - offset * Math.sin(angle);
                drawArrowhead(fromNode.x, fromNode.y, arrowX, arrowY, 10, strokeColor);
            }

            const midX = (fromNode.x + toNode.x) / 2;
            const midY = (fromNode.y + toNode.y) / 2;
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '12px Poppins';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(edge.weight.toString(), midX, midY - 5);
        }
    });

    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);

        if (node.isHighlighted) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = node.isStart ? '#ffea00' : '#00f7ff';
            ctx.fillStyle = node.isStart ? startNodeGradient : nodeGradient;
        } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = node.isStart ? startNodeGradient : (node.isDragging ? '#facc15' : '#3b82f6');
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = node.isStart ? 3 : 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Poppins';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id, node.x, node.y);
    });
}

// Generate HTML for displaying graph statistics
function getStatsHTML(algorithmResult = '') {
    const components = findConnectedComponents();
    const selfLoops = edges.filter(e => e.from === e.to).length;
    let statsHTML = `
        <div class="card-text">
            <h6>Graph Statistics</h6>
            <ul style="font-size: 0.9em;">
                <li><strong>Nodes</strong>: ${nodes.length}</li>
                <li><strong>Edges</strong>: ${edges.length}</li>
                <li><strong>Self-Loops</strong>: ${selfLoops}</li>
                <li><strong>Connected Components</strong>: ${components.length}</li>
                <li><strong>Graph Type</strong>: ${isDirected ? 'Directed' : 'Undirected'}</li>
            </ul>
    `;
    if (algorithmResult) {
        statsHTML += `<div class="algorithm-result mt-2">${algorithmResult}</div>`;
    }
    statsHTML += '</div>';
    return statsHTML;
}

// Update the output panel with the latest graph statistics
function updateStats(algorithmResult = '') {
    outputBody.innerHTML = getStatsHTML(algorithmResult);
}

// Find connected components in the graph using DFS
function findConnectedComponents() {
    if (nodes.length === 0) return [];
    const visited = new Set();
    const components = [];
    const adj = new Map();
    nodes.forEach(node => adj.set(node.id, []));
    edges.forEach(edge => {
        if (edge.from === edge.to) return;
        adj.get(edge.from)?.push(edge.to);
        if (!isDirected) {
            adj.get(edge.to)?.push(edge.from);
        }
    });

    function dfsComponent(nodeId, component) {
        visited.add(nodeId);
        component.push(nodeId);
        (adj.get(nodeId) || []).forEach(neighbor => {
            if (!visited.has(neighbor)) {
                dfsComponent(neighbor, component);
            }
        });
    }

    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            const component = [];
            dfsComponent(node.id, component);
            if (component.length > 0) components.push(component);
        }
    });
    return components;
}

// Save the current graph as a JSON file
function saveGraph() {
    if (nodes.length === 0 && edges.length === 0) {
        outputBody.innerHTML = `<div class="alert alert-warning">Graph is empty. Nothing to save.</div> ${getStatsHTML()}`;
        return;
    }
    outputBody.innerHTML = `<div class="alert alert-info">Saving graph...</div> ${getStatsHTML()}`;
    setTimeout(() => {
        const graph = { nodes, edges, isDirected, startNodeId };
        const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'graph_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        outputBody.innerHTML = `
            <div class="alert alert-success">Graph saved successfully!</div>
            ${getStatsHTML()}
        `;
    }, 500);
}

// Load a graph from a JSON file
function loadGraph(e) {
    const file = e.target.files[0];
    if (!file) return;
    outputBody.innerHTML = `<div class="alert alert-info">Loading graph...</div> ${getStatsHTML()}`;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const graph = JSON.parse(event.target.result);
            nodes = (graph.nodes || []).map(n => ({ ...n, isHighlighted: false, isStart: (n.id === graph.startNodeId), isDragging: false }));
            edges = (graph.edges || []).map(e => ({ ...e, isHighlighted: false, isShortestPath: false, isNew: false }));
            isDirected = graph.isDirected || false;
            startNodeId = graph.startNodeId || null;

            document.getElementById('toggleDirectedBtn').innerHTML = isDirected ? '<i class="bi bi-arrow-right"></i> Undirected' : '<i class="bi bi-arrows-angle-contract"></i> Directed';
            document.getElementById('mobileToggleDirectedBtn').innerHTML = isDirected ? '<i class="bi bi-arrow-right"></i>' : '<i class="bi bi-arrows-angle-contract"></i>';

            document.getElementById('runBtn').disabled = true;
            document.getElementById('stepBtn').disabled = true;
            document.getElementById('mobileRunBtn').disabled = true;
            document.getElementById('mobileStepBtn').disabled = true;
            speedSlider.disabled = true;
            mobileSpeedSlider.disabled = true;
            if (startNodeId && nodes.some(n => n.id === startNodeId)) {
                document.getElementById('runBtn').disabled = false;
                document.getElementById('stepBtn').disabled = false;
                document.getElementById('mobileRunBtn').disabled = false;
                document.getElementById('mobileStepBtn').disabled = false;
                speedSlider.disabled = false;
                mobileSpeedSlider.disabled = false;
            }

            undoStack = [];
            algorithmSteps = [];
            stepDescriptions = [];
            currentStepIndex = -1;
            algorithmCompleted = false;
            isPaused = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            visualizationState = { highlightedNodes: new Set(), highlightedEdges: new Set(), shortestPathEdges: new Set(), finalDistances: null, finalPrevious: null };

            updateStats();
            needsRedraw = true;
            scheduleRedraw();
            outputBody.innerHTML = `
                <div class="alert alert-success">Graph loaded successfully!</div>
                ${getStatsHTML()}
            `;
        } catch (err) {
            console.error("Error loading graph:", err);
            outputBody.innerHTML = `
                <div class="alert alert-danger">Error loading graph: Invalid JSON format or data. Check console for details.</div>
                ${getStatsHTML()}
            `;
        } finally {
            e.target.value = null;
        }
    };
    reader.onerror = () => {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error reading file.</div>
            ${getStatsHTML()}
        `;
        e.target.value = null;
    };
    reader.readAsText(file);
}

// Reset the canvas and graph to its initial state
function resetCanvas() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    nodes = [];
    edges = [];
    undoStack = [];
    edgeMode = false;
    deleteMode = false;
    selectedNodes = [];
    edgePreview = null;
    currentAlgorithm = null;
    startNodeId = null;
    algorithmSteps = [];
    stepDescriptions = [];
    currentStepIndex = -1;
    algorithmCompleted = false;
    isPaused = false;
    visualizationState = { highlightedNodes: new Set(), highlightedEdges: new Set(), shortestPathEdges: new Set(), finalDistances: null, finalPrevious: null };

    const addEdgeBtn = document.getElementById('addEdgeBtn');
    const mobileAddEdgeBtn = document.getElementById('mobileAddEdgeBtn');
    addEdgeBtn.textContent = 'Add Edge';
    mobileAddEdgeBtn.innerHTML = '<i class="bi bi-link"></i>';
    addEdgeBtn.classList.remove('btn-danger', 'btn-success');
    addEdgeBtn.classList.add('btn-primary');
    mobileAddEdgeBtn.classList.remove('btn-danger', 'btn-success');
    mobileAddEdgeBtn.classList.add('btn-primary');

    const deleteBtn = document.getElementById('deleteBtn');
    const mobileDeleteBtn = document.getElementById('mobileDeleteBtn');
    deleteBtn.textContent = 'Delete';
    mobileDeleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
    deleteBtn.classList.remove('btn-danger');
    deleteBtn.classList.add('btn-primary');
    mobileDeleteBtn.classList.remove('btn-danger');
    mobileDeleteBtn.classList.add('btn-primary');

    document.getElementById('runBtn').disabled = true;
    document.getElementById('stepBtn').disabled = true;
    document.getElementById('mobileRunBtn').disabled = true;
    document.getElementById('mobileStepBtn').disabled = true;
    speedSlider.disabled = true;
    mobileSpeedSlider.disabled = true;
    speedSlider.value = 500;
    mobileSpeedSlider.value = 500;
    animationSpeed = 500;

    canvas.classList.remove('edge-mode', 'dragging', 'delete-mode');
    updateStats();
    needsRedraw = true;
    scheduleRedraw();
    outputBody.innerHTML = `
        <div class="alert alert-info">Graph has been reset.</div>
        ${getStatsHTML()}
    `;
}

// Toggle the visibility of the output panel
function toggleOutput() {
    const panel = document.getElementById('bottomPanel');
    const icon = document.getElementById('toggleOutputBtn').querySelector('i');
    panel.classList.toggle('collapsed');
    if (panel.classList.contains('collapsed')) {
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    } else {
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    }
    setTimeout(() => {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        initGradients();
        needsRedraw = true;
        scheduleRedraw();
    }, 50);
}

// Run the selected algorithm using a Web Worker
function runAlgorithm() {
    if (!currentAlgorithm) {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Please select an algorithm (BFS, DFS, Dijkstra, or Bellman-Ford).</div>
            ${getStatsHTML()}
        `;
        return;
    }
    if (nodes.length === 0) {
        outputBody.innerHTML = `
            <div class="alert alert-warning">Graph is empty. Add some nodes and edges first.</div>
            ${getStatsHTML()}
        `;
        return;
    }
    if (!startNodeId || !nodes.some(n => n.id === startNodeId)) {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Please select a valid start node using the algorithm button.</div>
            ${getStatsHTML()}
        `;
        return;
    }
    if (currentAlgorithm === 'dijkstra' && edges.some(e => e.weight < 0)) {
        outputBody.innerHTML = `
            <div class="alert alert-danger">Error: Dijkstra’s algorithm cannot handle negative edge weights. Use Bellman-Ford instead.</div>
            ${getStatsHTML()}
        `;
        return;
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    algorithmSteps = [];
    stepDescriptions = [];
    currentStepIndex = -1;
    algorithmCompleted = false;
    isPaused = false;
    visualizationState = { highlightedNodes: new Set(), highlightedEdges: new Set(), shortestPathEdges: new Set(), finalDistances: null, finalPrevious: null };
    nodes.forEach(n => {
        n.isHighlighted = false;
        n.isStart = n.id === startNodeId;
    });
    edges.forEach(e => {
        e.isHighlighted = false;
        e.isShortestPath = false;
        e.isNew = false;
    });
    needsRedraw = true;
    scheduleRedraw();

    outputBody.innerHTML = `<div class="alert alert-info">Running ${currentAlgorithm.toUpperCase()}...</div> ${getStatsHTML()}`;

    const workerCode = `
        self.onmessage = function(e) {
            const { nodes: workerNodes, edges: workerEdges, startNodeId: workerStartNodeId, algorithm, isDirected } = e.data;
            let currentAlgorithmSteps = [];
            let currentStepDescriptions = [];

            let distances = null;
            let previous = null;

            function recordStep(stepData, description) {
                currentAlgorithmSteps.push(stepData);
                currentStepDescriptions.push(description);
            }

            class PriorityQueue {
                constructor() {
                    this.values = [];
                }
                enqueue(element, priority) {
                    this.values.push({ element, priority });
                    this._bubbleUpFromIndex(this.values.length - 1);
                }
                _bubbleUpFromIndex(idx) {
                    const element = this.values[idx];
                    while (idx > 0) {
                        let parentIdx = Math.floor((idx - 1) / 2);
                        let parent = this.values[parentIdx];
                        if (element.priority >= parent.priority) break;
                        this.values[parentIdx] = element;
                        this.values[idx] = parent;
                        idx = parentIdx;
                    }
                }
                dequeue() {
                    if (this.values.length === 0) return null;
                    const min = this.values[0];
                    const end = this.values.pop();
                    if (this.values.length > 0) {
                        this.values[0] = end;
                        this._sinkDownFromIndex(0);
                    }
                    return min.element;
                }
                _sinkDownFromIndex(idx) {
                    const length = this.values.length;
                    const element = this.values[idx];
                    while (true) {
                        let leftChildIdx = 2 * idx + 1;
                        let rightChildIdx = 2 * idx + 2;
                        let leftChild, rightChild;
                        let swap = null;
                        if (leftChildIdx < length) {
                            leftChild = this.values[leftChildIdx];
                            if (leftChild.priority < element.priority) {
                                swap = leftChildIdx;
                            }
                        }
                        if (rightChildIdx < length) {
                            rightChild = this.values[rightChildIdx];
                            if (
                                (swap === null && rightChild.priority < element.priority) ||
                                (swap !== null && leftChild && rightChild.priority < leftChild.priority)
                            ) {
                                swap = rightChildIdx;
                            }
                        }
                        if (swap === null) break;
                        this.values[idx] = this.values[swap];
                        this.values[swap] = element;
                        idx = swap;
                    }
                }
                isEmpty() {
                    return this.values.length === 0;
                }
            }

            if (algorithm === 'bfs') {
                const visited = new Set();
                const queue = [workerStartNodeId];
                visited.add(workerStartNodeId);
                recordStep({ type: 'node', id: workerStartNodeId }, \`Start BFS at node \${workerStartNodeId}. Queue: [\${workerStartNodeId}]\`);

                while (queue.length > 0) {
                    const nodeId = queue.shift();
                    recordStep({ type: 'visit', id: nodeId }, \`Visiting node \${nodeId}. Dequeue \${nodeId}. Queue: [\${queue.join(', ')}]\`);

                    const neighbors = workerEdges
                        .filter(edge => (edge.from === nodeId) || (!isDirected && edge.to === nodeId))
                        .map(edge => edge.from === nodeId ? edge.to : edge.from)
                        .filter(neighborId => !visited.has(neighborId) && workerNodes.some(n => n.id === neighborId));

                    neighbors.sort((a,b) => a - b);

                    for (const neighbor of neighbors) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                        const edgeData = workerEdges.find(e => (e.from === nodeId && e.to === neighbor) || (!isDirected && e.to === nodeId && e.from === neighbor));
                        if (edgeData) {
                            recordStep({ type: 'edge', edge: { from: edgeData.from, to: edgeData.to, weight: edgeData.weight, isShortestPath: false } }, \`Traverse edge \${nodeId} \u2192 \${neighbor}. Add \${neighbor} to queue. Queue: [\${queue.join(', ')}]\`);
                        }
                    }
                }
                recordStep({ type: 'complete', message: 'BFS Complete.' }, 'BFS traversal finished.');
            } else if (algorithm === 'dfs') {
                const visited = new Set();
                const stack = [];

                function dfsRecursive(nodeId) {
                    visited.add(nodeId);
                    stack.push(nodeId);
                    recordStep({ type: 'visit', id: nodeId }, \`Visiting node \${nodeId}. Path: \${stack.join(' \u2192 ')}\`);

                    const neighbors = workerEdges
                        .filter(edge => (edge.from === nodeId) || (!isDirected && edge.to === nodeId))
                        .map(edge => edge.from === nodeId ? edge.to : edge.from)
                        .filter(neighborId => !visited.has(neighborId) && workerNodes.some(n => n.id === neighborId));

                    neighbors.sort((a,b) => a - b);

                    for (const neighbor of neighbors) {
                        const edgeData = workerEdges.find(e => (e.from === nodeId && e.to === neighbor) || (!isDirected && e.to === nodeId && e.from === neighbor));
                        if (edgeData) {
                            recordStep({ type: 'edge', edge: { from: edgeData.from, to: edgeData.to, weight: edgeData.weight, isShortestPath: false } }, \`Traverse edge \${nodeId} \u2192 \${neighbor}.\`);
                        }
                        dfsRecursive(neighbor);
                    }
                    stack.pop();
                    recordStep({ type: 'backtrack', id: nodeId }, \`Backtrack from node \${nodeId}. Path: \${stack.join(' \u2192 ')}\`);
                }
                recordStep({ type: 'node', id: workerStartNodeId }, \`Start DFS at node \${workerStartNodeId}.\`);
                dfsRecursive(workerStartNodeId);
                recordStep({ type: 'complete', message: 'DFS Complete.' }, 'DFS traversal finished.');
            } else if (algorithm === 'dijkstra') {
                distances = {};
                previous = {};
                const pq = new PriorityQueue();
                const visitedInDijkstra = new Set();

                workerNodes.forEach(node => {
                    distances[node.id] = Infinity;
                    previous[node.id] = null;
                });
                distances[workerStartNodeId] = 0;
                pq.enqueue(workerStartNodeId, 0);
                recordStep({ type: 'node', id: workerStartNodeId }, \`Start Dijkstra at node \${workerStartNodeId}. Distances: { \${workerStartNodeId}: 0 }, PQ: [\${workerStartNodeId}(0)]\`);

                while (!pq.isEmpty()) {
                    const u = pq.dequeue();

                    if (visitedInDijkstra.has(u)) continue;
                    visitedInDijkstra.add(u);

                    recordStep({ type: 'visit', id: u }, \`Visiting node \${u}. Current distance: \${distances[u]}.\`);

                    const neighbors = workerEdges
                        .filter(edge => (edge.from === u) || (!isDirected && edge.to === u))
                        .map(edge => ({
                            id: edge.from === u ? edge.to : edge.from,
                            weight: edge.weight,
                            originalEdge: edge
                        }))
                        .filter(neighborInfo => workerNodes.some(n => n.id === neighborInfo.id));

                    neighbors.sort((a,b) => a.id - b.id);

                    for (const neighbor of neighbors) {
                        const v = neighbor.id;
                        const weightUV = neighbor.weight;
                        const alt = distances[u] + weightUV;

                        if (alt < distances[v]) {
                            distances[v] = alt;
                            previous[v] = u;
                            pq.enqueue(v, alt);
                            recordStep({ type: 'edge', edge: { from: neighbor.originalEdge.from, to: neighbor.originalEdge.to, weight: neighbor.originalEdge.weight, isShortestPath: false } }, \`Relax edge \${u}\u2192\${v}. New distance to \${v}: \${alt}. Update PQ.\`);
                        }
                    }
                }
                workerNodes.forEach(node => {
                    if (distances[node.id] === Infinity || distances[node.id] == null) return;
                    let curr = node.id;
                    const path = [];
                    while (previous[curr] != null && curr !== workerStartNodeId) {
                        const prevNode = previous[curr];
                        const edge = workerEdges.find(e =>
                            (e.from === prevNode && e.to === curr) ||
                            (!isDirected && e.to === prevNode && e.from === curr)
                        );
                        if (edge) path.unshift(edge); else break;
                        if (path.length > workerNodes.length) { break; }
                        curr = prevNode;
                    }
                    path.forEach(edgeInPath => {
                        recordStep({ type: 'edge', edge: { from: edgeInPath.from, to: edgeInPath.to, weight: edgeInPath.weight, isShortestPath: true } }, \`Shortest path edge: \${edgeInPath.from}\u2192\${edgeInPath.to}\`);
                    });
                });
                recordStep({ type: 'complete', message: 'Dijkstra Complete.' }, 'Dijkstra algorithm finished.');
            } else if (algorithm === 'bellman-ford') {
                distances = {};
                previous = {};
                const reachable = new Set([workerStartNodeId]);

                workerNodes.forEach(node => {
                    distances[node.id] = Infinity;
                    previous[node.id] = null;
                });
                distances[workerStartNodeId] = 0;
                recordStep({ type: 'node', id: workerStartNodeId }, \`Start Bellman-Ford at node \${workerStartNodeId}. Distances: { \${workerStartNodeId}: 0 }\`);

                for (let i = 0; i < workerNodes.length - 1; i++) {
                    let updatedInIteration = false;
                    recordStep({ type: 'iteration', iteration: i + 1 }, \`Bellman-Ford: Iteration \${i + 1}\`);
                    for (const edge of workerEdges) {
                        const u = edge.from;
                        const v = edge.to;
                        const weight = edge.weight;
                        if (distances[u] !== Infinity && distances[u] + weight < distances[v]) {
                            distances[v] = distances[u] + weight;
                            previous[v] = u;
                            reachable.add(v);
                            updatedInIteration = true;
                            recordStep({ type: 'edge', edge: { from: u, to: v, weight: weight, isShortestPath: false } }, \`Relax edge \${u}\u2192\${v}. New distance to \${v}: \${distances[v].toFixed(2)}\`);
                        }
                        if (!isDirected) {
                            const reverseU = edge.to;
                            const reverseV = edge.from;
                            if (distances[reverseU] !== Infinity && distances[reverseU] + weight < distances[reverseV]) {
                                distances[reverseV] = distances[reverseU] + weight;
                                previous[reverseV] = reverseU;
                                reachable.add(reverseV);
                                updatedInIteration = true;
                                recordStep({ type: 'edge', edge: { from: reverseU, to: reverseV, weight: weight, isShortestPath: false } }, \`Relax edge \${reverseU}\u2192\${reverseV} (undirected). New distance to \${reverseV}: \${distances[reverseV].toFixed(2)}\`);
                            }
                        }
                    }
                    if (!updatedInIteration) break;
                }

                let negativeCycleDetected = false;
                let cycleEdges = [];
                for (const edge of workerEdges) {
                    const u = edge.from;
                    const v = edge.to;
                    const weight = edge.weight;
                    if (reachable.has(u) && distances[u] !== Infinity && distances[u] + weight < distances[v]) {
                        negativeCycleDetected = true;
                        cycleEdges.push({ from: u, to: v, weight: weight });
                        recordStep({ type: 'negative_cycle', edge: { from: u, to: v, weight: weight } }, \`Negative cycle detected via edge \${u}\u2192\${v}\`);
                    }
                    if (!isDirected) {
                        const reverseU = edge.to;
                        const reverseV = edge.from;
                        if (reachable.has(reverseU) && distances[reverseU] !== Infinity && distances[reverseU] + weight < distances[reverseV]) {
                            negativeCycleDetected = true;
                            cycleEdges.push({ from: reverseU, to: reverseV, weight: weight });
                            recordStep({ type: 'negative_cycle', edge: { from: reverseU, to: reverseV, weight: weight } }, \`Negative cycle detected via edge \${reverseU}\u2192\${reverseV} (undirected)\`);
                        }
                    }
                }

                workerNodes.forEach(node => {
                    if (distances[node.id] === Infinity || distances[node.id] == null || !reachable.has(node.id)) return;
                    let curr = node.id;
                    const path = [];
                    const visited = new Set();
                    while (previous[curr] != null && curr !== workerStartNodeId && !visited.has(curr)) {
                        visited.add(curr);
                        const prevNode = previous[curr];
                        const edge = workerEdges.find(e =>
                            (e.from === prevNode && e.to === curr) ||
                            (!isDirected && e.to === prevNode && e.from === curr)
                        );
                        if (edge) {
                            path.unshift(edge);
                        } else {
                            break;
                        }
                        if (path.length > workerNodes.length) {
                            break;
                        }
                        curr = prevNode;
                    }
                    path.forEach(edgeInPath => {
                        recordStep({ type: 'edge', edge: { from: edgeInPath.from, to: edgeInPath.to, weight: edgeInPath.weight, isShortestPath: true } }, \`Shortest path edge: \${edgeInPath.from}\u2192\${edgeInPath.to} (weight: \${edgeInPath.weight})\`);
                    });
                });

                if (negativeCycleDetected) {
                    self.postMessage({
                        error: \`Negative weight cycle detected involving edge(s): \${cycleEdges.map(e => \`\${e.from}\u2192\${e.to} (weight: \${e.weight})\`).join(', ')}. Shortest paths computed for reachable nodes.\`,
                        algorithmSteps: currentAlgorithmSteps,
                        stepDescriptions: currentStepDescriptions,
                        finalDistances: distances,
                        finalPrevious: previous
                    });
                } else {
                    recordStep({ type: 'complete', message: 'Bellman-Ford Complete.' }, 'Bellman-Ford algorithm finished.');
                    self.postMessage({
                        algorithmSteps: currentAlgorithmSteps,
                        stepDescriptions: currentStepDescriptions,
                        finalDistances: distances,
                        finalPrevious: previous
                    });
                }
            }
            self.postMessage({
                algorithmSteps: currentAlgorithmSteps,
                stepDescriptions: currentStepDescriptions,
                finalDistances: distances,
                finalPrevious: previous
            });
        };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);
    const worker = new Worker(blobURL);

    worker.onmessage = function(e) {
        URL.revokeObjectURL(blobURL);
        if (e.data.error) {
            outputBody.innerHTML = `
                <div class="alert alert-warning">${e.data.error}</div>
                ${getStatsHTML()}
            `;
            algorithmSteps = e.data.algorithmSteps || [];
            stepDescriptions = e.data.stepDescriptions || [];
            visualizationState.finalDistances = e.data.finalDistances;
            visualizationState.finalPrevious = e.data.finalPrevious;
            currentStepIndex = -1;
            algorithmCompleted = false;
            isPaused = false;
            animateSteps();
            document.getElementById('runBtn').disabled = true;
            document.getElementById('stepBtn').disabled = false;
            document.getElementById('mobileRunBtn').disabled = true;
            document.getElementById('mobileStepBtn').disabled = false;
            speedSlider.disabled = false;
            mobileSpeedSlider.disabled = false;
            return;
        }

        algorithmSteps = e.data.algorithmSteps || [];
        stepDescriptions = e.data.stepDescriptions || [];

        if (algorithmSteps.length === 0 && !e.data.error) {
            outputBody.innerHTML = `
                <div class="alert alert-warning">Algorithm ran, but no visualization steps were generated. This might indicate an issue with the graph structure or start node for the selected algorithm (e.g., isolated start node).</div>
                ${getStatsHTML()}
            `;
            document.getElementById('runBtn').disabled = false;
            document.getElementById('stepBtn').disabled = true;
            document.getElementById('mobileRunBtn').disabled = false;
            document.getElementById('mobileStepBtn').disabled = true;
            return;
        }

        currentStepIndex = -1;
        algorithmCompleted = false;
        isPaused = false;

        if (e.data.finalDistances) {
            visualizationState.finalDistances = e.data.finalDistances;
        }
        if (e.data.finalPrevious) {
            visualizationState.finalPrevious = e.data.finalPrevious;
        }

        animateSteps();

        document.getElementById('runBtn').disabled = true;
        document.getElementById('stepBtn').disabled = false;
        document.getElementById('mobileRunBtn').disabled = true;
        document.getElementById('mobileStepBtn').disabled = false;
        speedSlider.disabled = false;
        mobileSpeedSlider.disabled = false;
    };

    worker.onerror = function(err) {
        URL.revokeObjectURL(blobURL);
        console.error("Worker error:", err);
        outputBody.innerHTML = `
            <div class="alert alert-danger">Critical error running algorithm in worker: ${err.message}. Check console.</div>
            ${getStatsHTML()}
        `;
        document.getElementById('runBtn').disabled = false;
        document.getElementById('stepBtn').disabled = true;
        document.getElementById('mobileRunBtn').disabled = false;
        document.getElementById('mobileStepBtn').disabled = true;
    };
    const nodesClone = JSON.parse(JSON.stringify(nodes));
    const edgesClone = JSON.parse(JSON.stringify(edges));
    worker.postMessage({ nodes: nodesClone, edges: edgesClone, startNodeId, algorithm: currentAlgorithm, isDirected });
}

// Animate the algorithm steps with a delay between each step
function animateSteps() {
    let animationIndex = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;

    function animateNextStepWithTimeout() {
        if (isPaused) {
            return;
        }
        if (animationIndex >= algorithmSteps.length) {
            if (animationFrameId) {
                clearTimeout(animationFrameId);
                animationFrameId = null;
            }
            algorithmCompleted = true;
            displayAlgorithmCompletion();
            return;
        }

        const step = algorithmSteps[animationIndex];
        applyVisualStep(step);

        outputBody.innerHTML = `
            <div class="alert alert-info">
                Step ${animationIndex + 1}/${algorithmSteps.length}: ${stepDescriptions[animationIndex] || "Processing..."}
            </div>
            ${getStatsHTML()}
        `;

        needsRedraw = true;
        scheduleRedraw();

        currentStepIndex = animationIndex;
        animationIndex++;

        if (!isPaused) {
            animationFrameId = setTimeout(animateNextStepWithTimeout, animationSpeed);
        }
    }
    if (animationFrameId) {
        clearTimeout(animationFrameId);
    }
    animateNextStepWithTimeout();
}

// Display the results of the algorithm upon completion
function displayAlgorithmCompletion() {
    let algorithmResultText = `<h6>${currentAlgorithm ? currentAlgorithm.toUpperCase() : 'ALGORITHM'} RESULTS</h6>`;
    if (currentAlgorithm === 'bfs' || currentAlgorithm === 'dfs') {
        const traversal = algorithmSteps
            .filter(step => step.type === 'visit' || (step.type === 'node' && step.id === startNodeId))
            .map(step => step.id)
            .filter((id, index, self) => self.indexOf(id) === index)
            .join(' \u2192 ');
        algorithmResultText += `<p>Traversal Order: ${traversal || 'None (or start node not reachable/processed)'}</p>`;
    } else if ((currentAlgorithm === 'dijkstra' || currentAlgorithm === 'bellman-ford') && visualizationState.finalDistances) {
        algorithmResultText += `<p>Shortest paths from node ${startNodeId}:</p><ul class="list-unstyled" style="font-size: 0.9em;">`;
        nodes.forEach(node => {
            const dist = visualizationState.finalDistances[node.id];
            if (dist === Infinity || dist == null) {
                algorithmResultText += `<li>Node ${node.id}: <span class="text-muted">Not reachable</span></li>`;
            } else {
                let pathString = "";
                let currentPathNodeId = node.id;
                const pathArray = [];
                const visitedInPathReconstruction = new Set();

                if (node.id === startNodeId) {
                    pathArray.push(startNodeId);
                } else {
                    while (visualizationState.finalPrevious && visualizationState.finalPrevious[currentPathNodeId] != null && currentPathNodeId !== startNodeId) {
                        if (visitedInPathReconstruction.has(currentPathNodeId)) {
                            pathArray.splice(0, pathArray.length, "Cycle in path reconstruction");
                            break;
                        }
                        visitedInPathReconstruction.add(currentPathNodeId);
                        pathArray.unshift(currentPathNodeId);
                        currentPathNodeId = visualizationState.finalPrevious[currentPathNodeId];
                        if (pathArray.length > nodes.length + 1) {
                            pathArray.splice(0, pathArray.length, "Path reconstruction error (too long)");
                            break;
                        }
                    }
                    if (pathArray[0] !== "Cycle in path reconstruction" && pathArray[0] !== "Path reconstruction error (too long)") {
                        if (currentPathNodeId === startNodeId) {
                            pathArray.unshift(startNodeId);
                        } else if (dist !== Infinity && node.id !== startNodeId && pathArray.indexOf(startNodeId) === -1) {
                            pathArray.splice(0, pathArray.length, "Path to start not fully reconstructed");
                        }
                    }
                }
                pathString = pathArray.join(' \u2192 ');
                algorithmResultText += `<li>Node ${node.id}: Distance = <span class="fw-bold">${dist.toFixed(2)}</span>, Path = ${pathString}</li>`;
            }
        });
        algorithmResultText += '</ul>';
    } else if ((currentAlgorithm === 'dijkstra' || currentAlgorithm === 'bellman-ford') && !visualizationState.finalDistances) {
        algorithmResultText += `<p class="text-warning">Path information not available (algorithm might have encountered an issue or graph was empty).</p>`;
    }

    outputBody.innerHTML = `
        <div class="alert alert-success">Algorithm completed.</div>
        <h6>Execution Log</h6>
        ${stepDescriptions.length > 0 ? `
            <ol style="max-height: 150px; overflow-y: auto; font-size: 0.85em; padding-left: 20px;">
                ${stepDescriptions.map(desc => `<li>${desc}</li>`).join('')}
            </ol>
        ` : '<p>No detailed steps logged.</p>'}
        ${getStatsHTML(algorithmResultText)}
    `;
    needsRedraw = true;
    scheduleRedraw();
    document.getElementById('runBtn').disabled = false;
    document.getElementById('mobileRunBtn').disabled = false;
}

// Step through the algorithm one step at a time
function stepThrough() {
    if (isPaused && animationFrameId) {
        clearTimeout(animationFrameId);
        animationFrameId = null;
        isPaused = false;
    } else if (animationFrameId) {
        clearTimeout(animationFrameId);
        animationFrameId = null;
    }

    if (algorithmSteps.length === 0) {
        outputBody.innerHTML = `
            <div class="alert alert-warning">No steps available. Please run an algorithm first.</div>
            ${getStatsHTML()}
        `;
        return;
    }

    if (algorithmCompleted && currentStepIndex === algorithmSteps.length -1) {
        currentStepIndex = -1;
        algorithmCompleted = false;
        nodes.forEach(n => { n.isHighlighted = false; n.isStart = (n.id === startNodeId); });
        edges.forEach(e => { e.isHighlighted = false; e.isShortestPath = false; });
        visualizationState = {
            highlightedNodes: new Set(),
            highlightedEdges: new Set(),
            shortestPathEdges: new Set(),
            finalDistances: visualizationState.finalDistances,
            finalPrevious: visualizationState.finalPrevious
        };
    }

    currentStepIndex++;
    if (currentStepIndex >= algorithmSteps.length) {
        currentStepIndex = algorithmSteps.length - 1;
        algorithmCompleted = true;
        displayAlgorithmCompletion();
        return;
    }

    nodes.forEach(n => { n.isHighlighted = false; n.isStart = (n.id === startNodeId); });
    edges.forEach(e => { e.isHighlighted = false; e.isShortestPath = false; });

    visualizationState.highlightedNodes.clear();
    visualizationState.highlightedEdges.clear();
    visualizationState.shortestPathEdges.clear();

    for (let i = 0; i <= currentStepIndex; i++) {
        applyVisualStep(algorithmSteps[i], true);
    }

    outputBody.innerHTML = `
        <div class="alert alert-info">
            Step ${currentStepIndex + 1}/${algorithmSteps.length}: ${stepDescriptions[currentStepIndex] || "Processing..."}
        </div>
        ${getStatsHTML()}
    `;

    needsRedraw = true;
    scheduleRedraw();
}

// Apply a visual step in the algorithm (highlight nodes/edges)
function applyVisualStep(step, isStepping = false) {
    if (!step) return;

    const nodeToHighlight = nodes.find(n => n.id === step.id);
    if (step.type === 'node' || step.type === 'visit' || step.type === 'backtrack') {
        if (nodeToHighlight) {
            nodeToHighlight.isHighlighted = true;
            if (isStepping) visualizationState.highlightedNodes.add(nodeToHighlight.id);
            if (nodeToHighlight.id === startNodeId) nodeToHighlight.isStart = true;
        }
    } else if (step.type === 'edge' && step.edge) {
        const stepEdgeFrom = step.edge.from;
        const stepEdgeTo = step.edge.to;
        const stepEdgeWeight = step.edge.weight;
        let foundEdge = null;

        if (isDirected) {
            foundEdge = edges.find(e => e.from === stepEdgeFrom && e.to === stepEdgeTo && Math.abs(e.weight - stepEdgeWeight) < 0.01);
        } else {
            foundEdge = edges.find(e =>
                Math.abs(e.weight - stepEdgeWeight) < 0.01 &&
                ((e.from === stepEdgeFrom && e.to === stepEdgeTo) || (e.from === stepEdgeTo && e.to === stepEdgeFrom))
            );
        }

        if (foundEdge) {
            foundEdge.isHighlighted = true;
            const edgeKey = `${Math.min(foundEdge.from, foundEdge.to)}-${Math.max(foundEdge.from, foundEdge.to)}-${foundEdge.weight}`;
            if (isStepping) visualizationState.highlightedEdges.add(edgeKey);

            if (step.edge.isShortestPath) {
                foundEdge.isShortestPath = true;
                if (isStepping) visualizationState.shortestPathEdges.add(edgeKey);
            }
        }
    }
}

updateStats();
needsRedraw = true;
scheduleRedraw();