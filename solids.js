"use strict";

let gl;
let program;

const SOLIDS = [
    { name: "Tetrahedron", file: "tetrahedron.ply" },
    { name: "Cube", file: "cube.ply" },
    { name: "Octahedron", file: "octahedron.ply" },
    { name: "Dodecahedron", file: "dodecahedron.ply" },
    { name: "Icosahedron", file: "icosahedron.ply" }
];

let baseMeshes = [];
let dualMeshes = [];
let currentSolid = 0;
let showDual = false;
let showWireframe = true;

let positionBuffer = null;
let indexBuffer = null;
let edgeBuffer = null;
let dottedBuffer = null;
let indexType = null;
let indexCount = 0;
let edgeCount = 0;
let dottedCount = 0;

let positionLoc = -1;
let modelLoc = null;
let colorLoc = null;
let projectionLoc = null;

const VIEW_SETTINGS = [
    { rotX: -40, rotY: 35, distance: 3.6, offset: [0, 0, 0] },
    { rotX: -35, rotY: 35, distance: 3.2, offset: [0, 0, 0] },
    { rotX: -40, rotY: 25, distance: 3.2, offset: [0, -0.1, 0] },
    { rotX: -25, rotY: 35, distance: 3.0, offset: [0, 0, 0] },
    { rotX: -25, rotY: 35, distance: 3.0, offset: [0, 0, 0] }
];
const NORMALIZE_SCALE = 1.6;

window.onload = async function () {
    const canvas = document.getElementById("glcanvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        return;
    }

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    if (program === -1) {
        return;
    }

    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.95, 0.95, 0.95, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);

    positionLoc = gl.getAttribLocation(program, "aPosition");
    modelLoc = gl.getUniformLocation(program, "uModel");
    colorLoc = gl.getUniformLocation(program, "uColor");
    projectionLoc = gl.getUniformLocation(program, "uProjection");

    baseMeshes = await loadAllSolids();
    dualMeshes = new Array(baseMeshes.length).fill(null);

    setMesh(0);

    window.addEventListener("keydown", keyHandler);
};

async function loadAllSolids() {
    const meshes = [];
    for (const solid of SOLIDS) {
        const mesh = await loadPLY(solid.file);
        meshes.push(prepareMesh(mesh));
    }
    return meshes;
}

async function loadPLY(file) {
    const response = await fetch(file);
    if (!response.ok) {
        throw new Error("Failed to load " + file);
    }
    const text = await response.text();
    return parsePLY(text);
}

function parsePLY(data) {
    const lines = data.split(/\r?\n/);
    let vertexCount = 0;
    let faceCount = 0;
    let i = 0;

    while (i < lines.length && !lines[i].includes("end_header")) {
        const line = lines[i].trim();
        if (line.startsWith("element vertex")) {
            vertexCount = parseInt(line.split(/\s+/)[2], 10);
        } else if (line.startsWith("element face")) {
            faceCount = parseInt(line.split(/\s+/)[2], 10);
        }
        i++;
    }

    i++;

    const vertices = [];
    for (let v = 0; v < vertexCount && i < lines.length; ) {
        const line = lines[i++].trim();
        if (line === "") {
            continue;
        }
        const parts = line.split(/\s+/).map(Number);
        if (parts.length >= 3) {
            vertices.push(parts[0], parts[1], parts[2]);
            v++;
        }
    }

    const faces = [];
    for (let f = 0; f < faceCount && i < lines.length; ) {
        const line = lines[i++].trim();
        if (line === "") {
            continue;
        }
        const parts = line.split(/\s+/).map(Number);
        const n = parts[0];
        if (n >= 3) {
            faces.push(parts.slice(1, 1 + n));
            f++;
        }
    }

    return { vertices, faces };
}

function prepareMesh(mesh) {
    mesh.normalizedVertices = buildNormalizedVertices(mesh.vertices);
    mesh.triangleIndices = triangulateFaces(mesh.faces);
    mesh.edgeIndices = buildEdges(mesh.faces);
    return mesh;
}

function buildNormalizedVertices(source) {
    if (source.length === 0) {
        return [];
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < source.length; i += 3) {
        const x = source[i];
        const y = source[i + 1];
        const z = source[i + 2];

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);

        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    let scale = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    if (scale === 0) {
        scale = 1;
    }

    const result = new Array(source.length);
    for (let i = 0; i < source.length; i += 3) {
        result[i] = ((source[i] - cx) / scale) * NORMALIZE_SCALE;
        result[i + 1] = ((source[i + 1] - cy) / scale) * NORMALIZE_SCALE;
        result[i + 2] = ((source[i + 2] - cz) / scale) * NORMALIZE_SCALE;
    }

    return result;
}

function triangulateFaces(faces) {
    const indices = [];
    for (const face of faces) {
        for (let i = 1; i < face.length - 1; i++) {
            indices.push(face[0], face[i], face[i + 1]);
        }
    }
    return indices;
}

function buildEdges(faces) {
    const edges = new Set();
    const indices = [];

    for (const face of faces) {
        for (let i = 0; i < face.length; i++) {
            const a = face[i];
            const b = face[(i + 1) % face.length];
            const min = Math.min(a, b);
            const max = Math.max(a, b);
            const key = min + ":" + max;
            if (!edges.has(key)) {
                edges.add(key);
                indices.push(a, b);
            }
        }
    }

    return indices;
}

function buildDottedEdgePositions(vertices, edgeIndices) {
    const positions = [];
    const targetLength = 0.12;
    const duty = 0.55;

    for (let i = 0; i < edgeIndices.length; i += 2) {
        const ia = edgeIndices[i] * 3;
        const ib = edgeIndices[i + 1] * 3;
        const ax = vertices[ia];
        const ay = vertices[ia + 1];
        const az = vertices[ia + 2];
        const bx = vertices[ib];
        const by = vertices[ib + 1];
        const bz = vertices[ib + 2];
        const dx = bx - ax;
        const dy = by - ay;
        const dz = bz - az;
        const length = Math.hypot(dx, dy, dz);
        if (length === 0) {
            continue;
        }
        const segments = Math.max(4, Math.floor(length / targetLength));
        for (let s = 0; s < segments; s++) {
            if (s % 2 !== 0) {
                continue;
            }
            const t0 = s / segments;
            const t1 = (s + duty) / segments;
            positions.push(
                ax + dx * t0,
                ay + dy * t0,
                az + dz * t0,
                ax + dx * t1,
                ay + dy * t1,
                az + dz * t1
            );
        }
    }

    return positions;
}

function setMesh(index) {
    currentSolid = index;
    const mesh = getActiveMesh();
    updateBuffers(mesh);
    render();
}

function getActiveMesh() {
    if (!showDual) {
        return baseMeshes[currentSolid];
    }

    if (!dualMeshes[currentSolid]) {
        dualMeshes[currentSolid] = buildDualMesh(baseMeshes[currentSolid]);
    }

    return dualMeshes[currentSolid];
}

function updateBuffers(mesh) {
    if (!positionBuffer) {
        positionBuffer = gl.createBuffer();
    }
    if (!indexBuffer) {
        indexBuffer = gl.createBuffer();
    }
    if (!edgeBuffer) {
        edgeBuffer = gl.createBuffer();
    }
    if (!dottedBuffer) {
        dottedBuffer = gl.createBuffer();
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normalizedVertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    const vertexCount = mesh.normalizedVertices.length / 3;
    indexType = getIndexType(vertexCount);

    const indexArray = indexType === gl.UNSIGNED_INT
        ? new Uint32Array(mesh.triangleIndices)
        : new Uint16Array(mesh.triangleIndices);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
    indexCount = mesh.triangleIndices.length;

    const edgeArray = indexType === gl.UNSIGNED_INT
        ? new Uint32Array(mesh.edgeIndices)
        : new Uint16Array(mesh.edgeIndices);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edgeArray, gl.STATIC_DRAW);
    edgeCount = mesh.edgeIndices.length;

    const dottedPositions = buildDottedEdgePositions(
        mesh.normalizedVertices,
        mesh.edgeIndices
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, dottedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dottedPositions), gl.STATIC_DRAW);
    dottedCount = dottedPositions.length / 3;
}

function getIndexType(vertexCount) {
    if (vertexCount <= 65535) {
        return gl.UNSIGNED_SHORT;
    }

    const ext = gl.getExtension("OES_element_index_uint");
    if (!ext) {
        alert("This mesh is too large for 16-bit indices in your browser.");
        return gl.UNSIGNED_SHORT;
    }

    return gl.UNSIGNED_INT;
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    const projection = perspective(60, aspect, 0.1, 10.0);
    const view = getViewSettings(currentSolid);
    const rotation = mult(
        rotate(view.rotY, [0, 1, 0]),
        rotate(view.rotX, [1, 0, 0])
    );
    const centered = translate(view.offset[0], view.offset[1], view.offset[2]);
    const model = mult(translate(0, 0, -view.distance), mult(centered, rotation));

    gl.uniformMatrix4fv(modelLoc, false, flatten(model));
    gl.uniformMatrix4fv(projectionLoc, false, flatten(projection));

    bindPositionBuffer(positionBuffer);
    gl.uniform4fv(colorLoc, new Float32Array([0.75, 0.85, 1.0, 1.0]));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, indexCount, indexType, 0);

    if (showWireframe) {
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.depthMask(false);
        gl.depthFunc(gl.LEQUAL);
        bindPositionBuffer(positionBuffer);
        gl.uniform4fv(colorLoc, new Float32Array([0.0, 0.0, 0.0, 1.0]));
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuffer);
        gl.drawElements(gl.LINES, edgeCount, indexType, 0);

        if (dottedCount > 0) {
            gl.depthFunc(gl.GREATER);
            bindPositionBuffer(dottedBuffer);
            gl.uniform4fv(colorLoc, new Float32Array([0.0, 0.0, 0.0, 0.6]));
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.drawArrays(gl.LINES, 0, dottedCount);
        }

        gl.depthFunc(gl.LESS);
        gl.depthMask(true);
        gl.enable(gl.POLYGON_OFFSET_FILL);
    }
}

function bindPositionBuffer(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);
}

function getViewSettings(index) {
    if (index >= 0 && index < VIEW_SETTINGS.length) {
        return VIEW_SETTINGS[index];
    }
    return { rotX: -25, rotY: 35, distance: 3.0, offset: [0, 0, 0] };
}

function keyHandler(e) {
    switch (e.key) {
        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
            const idx = parseInt(e.key, 10) - 1;
            if (idx >= 0 && idx < SOLIDS.length) {
                showDual = false;
                setMesh(idx);
            }
            break;
        }
        case "d":
        case "D":
            showDual = !showDual;
            setMesh(currentSolid);
            break;
        case "w":
        case "W":
            showWireframe = !showWireframe;
            render();
            break;
        default:
            break;
    }
}

function buildDualMesh(mesh) {
    const vertexCount = mesh.vertices.length / 3;
    const centroids = mesh.faces.map((face) => computeCentroid(face, mesh.vertices));
    const faceNormals = mesh.faces.map((face) => computeFaceNormal(face, mesh.vertices));
    const center = computeCenter(mesh.vertices);

    const adjacency = new Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
        adjacency[i] = [];
    }

    mesh.faces.forEach((face, faceIndex) => {
        for (const v of face) {
            adjacency[v].push(faceIndex);
        }
    });

    const dualFaces = [];
    for (let v = 0; v < vertexCount; v++) {
        const faces = adjacency[v];
        if (faces.length < 3) {
            continue;
        }
        const vertex = getVertex(mesh.vertices, v);
        const normal = normalizeSafe([
            vertex[0] - center[0],
            vertex[1] - center[1],
            vertex[2] - center[2]
        ]);
        const fallback = averageNormal(faces, faceNormals);
        const useNormal = normal[0] === 0 && normal[1] === 0 && normal[2] === 0
            ? fallback
            : normal;
        const ordered = orderCentroidsAroundVertex(vertex, faces, centroids, useNormal);
        if (ordered.length >= 3) {
            dualFaces.push(ordered);
        }
    }

    const dualVertices = [];
    for (const c of centroids) {
        dualVertices.push(c[0], c[1], c[2]);
    }

    return prepareMesh({ vertices: dualVertices, faces: dualFaces });
}

function computeCentroid(face, vertices) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const index of face) {
        const i = index * 3;
        cx += vertices[i];
        cy += vertices[i + 1];
        cz += vertices[i + 2];
    }
    const inv = 1 / face.length;
    return [cx * inv, cy * inv, cz * inv];
}

function computeCenter(vertices) {
    if (vertices.length === 0) {
        return [0, 0, 0];
    }
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < vertices.length; i += 3) {
        cx += vertices[i];
        cy += vertices[i + 1];
        cz += vertices[i + 2];
    }
    const inv = 1 / (vertices.length / 3);
    return [cx * inv, cy * inv, cz * inv];
}

function computeFaceNormal(face, vertices) {
    if (face.length < 3) {
        return [0, 0, 1];
    }

    const a = getVertex(vertices, face[0]);
    const b = getVertex(vertices, face[1]);
    const c = getVertex(vertices, face[2]);

    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];

    return normalizeSafe(cross(ab, ac));
}

function averageNormal(faceIndices, faceNormals) {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (const idx of faceIndices) {
        const n = faceNormals[idx];
        nx += n[0];
        ny += n[1];
        nz += n[2];
    }
    return normalizeSafe([nx, ny, nz]);
}

function orderCentroidsAroundVertex(vertex, faceIndices, centroids, normal) {
    const axis = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = normalizeSafe(cross(axis, normal));
    const v = cross(normal, u);

    const items = faceIndices.map((faceIndex) => {
        const c = centroids[faceIndex];
        const vec = [c[0] - vertex[0], c[1] - vertex[1], c[2] - vertex[2]];
        const angle = Math.atan2(dot(v, vec), dot(u, vec));
        return { faceIndex, angle };
    });

    items.sort((a, b) => a.angle - b.angle);
    return items.map((item) => item.faceIndex);
}

function getVertex(vertices, index) {
    const i = index * 3;
    return [vertices[i], vertices[i + 1], vertices[i + 2]];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalizeSafe(v) {
    const out = normalize(v);
    if (out[0] === 0 && out[1] === 0 && out[2] === 0) {
        return [0, 0, 1];
    }
    return out;
}

