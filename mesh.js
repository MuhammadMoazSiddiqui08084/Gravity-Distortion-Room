// ---------------- OBJECT WRAPPER ----------------
function createObject(geometry, transform) {
    return {
        vertices: geometry.vertices,
        colors: geometry.colors,
        normals: geometry.normals,
        indices: geometry.indices,
        transform: transform || [
            [1,0,0,0],
            [0,1,0,0],
            [0,0,1,0],
            [0,0,0,1]
        ]
    };
}
let gl, program;

let sceneObjects = [];

let cameraPos = [0, 0, 8];
let yaw = 0;
let shadingMode = 2; // 1=wireframe, 2=flat, 3=smooth
let speed = 0.3;
const LIGHT_DIR = [0.2, 0.8, 1.0];
const AMBIENT = 0.35;


// ---------------- PLY LOADER ----------------
async function loadPLY(url) {
    let response = await fetch(url);
    let text = await response.text();
    let lines = text.split('\n');
    let i = 0;
    let vertexCount = 0, faceCount = 0;
    let vertices = [], colors = [], normals = [], indices = [];
    // Parse header
    while (i < lines.length && !lines[i].includes("end_header")) {
        if (lines[i].startsWith("element vertex")) {
            vertexCount = parseInt(lines[i].split(" ")[2]);
        } else if (lines[i].startsWith("element face")) {
            faceCount = parseInt(lines[i].split(" ")[2]);
        }
        i++;
    }
    i++; // skip end_header
    // Parse vertices
    for (let v = 0; v < vertexCount && i < lines.length; v++, i++) {
        let parts = lines[i].trim().split(/\s+/).map(Number);
        vertices.push(parts[0], parts[1], parts[2]);
        colors.push(0.9, 0.7, 0.5); // light brown bunny
        normals.push(0, 0, 0); // will compute later
    }
    console.log('PLY: Parsed', vertices.length/3, 'vertices, expected', vertexCount);
    // Parse faces (indices)
    let facesParsed = 0;
    const maxFaces = 5000; // Limit for performance
    for (let f = 0; f < faceCount && i < lines.length && facesParsed < maxFaces; f++, i++) {
        if (facesParsed >= faceCount) break;
        let parts = lines[i].trim().split(/\s+/).map(Number);
        let n = parts[0];
        let face = parts.slice(1);
        // Guard: skip faces with out-of-bounds indices
        let valid = true;
        for (let idx of face) {
            if (idx < 0 || idx >= vertexCount) { valid = false; break; }
        }
        if (!valid) continue;
        // Triangulate faces (should be triangles for bunny)
        for (let j = 1; j < n - 1; j++) {
            indices.push(face[0], face[j], face[j + 1]);
        }
        facesParsed++;
    }
    console.log('PLY: Parsed', facesParsed, 'faces, expected', faceCount, '| Indices:', indices.length);
    // Normalize vertices to fit scene (center and scale to [-1,1])
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let v = 0; v < vertices.length; v += 3) {
        let x = vertices[v], y = vertices[v+1], z = vertices[v+2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    let scale = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    if (scale === 0) scale = 1;
    for (let v = 0; v < vertices.length; v += 3) {
        vertices[v]   = ((vertices[v]   - cx) / scale) * 2;
        vertices[v+1] = ((vertices[v+1] - cy) / scale) * 2;
        vertices[v+2] = ((vertices[v+2] - cz) / scale) * 2;
    }
    // Compute per-vertex normals
    for (let n = 0; n < normals.length; ++n) normals[n] = 0;
    for (let i = 0; i < indices.length; i += 3) {
        let ia = indices[i] * 3, ib = indices[i+1] * 3, ic = indices[i+2] * 3;
        let ax = vertices[ia], ay = vertices[ia+1], az = vertices[ia+2];
        let bx = vertices[ib], by = vertices[ib+1], bz = vertices[ib+2];
        let cx_ = vertices[ic], cy_ = vertices[ic+1], cz_ = vertices[ic+2];
        let ux = bx - ax, uy = by - ay, uz = bz - az;
        let vx = cx_ - ax, vy = cy_ - ay, vz = cz_ - az;
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        normals[ia]   += nx; normals[ia+1]   += ny; normals[ia+2]   += nz;
        normals[ib]   += nx; normals[ib+1]   += ny; normals[ib+2]   += nz;
        normals[ic]   += nx; normals[ic+1]   += ny; normals[ic+2]   += nz;
    }
    // Normalize normals
    for (let v = 0; v < normals.length; v += 3) {
        let nx = normals[v], ny = normals[v+1], nz = normals[v+2];
        let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        if (len > 0) {
            normals[v] /= len;
            normals[v+1] /= len;
            normals[v+2] /= len;
        } else {
            normals[v] = 0; normals[v+1] = 0; normals[v+2] = 1;
        }
    }
    return { vertices, colors, normals, indices };
}

// ---------------- INIT ----------------

window.onload = async function () {
    const canvas = document.getElementById("glcanvas");
    gl = WebGLUtils.setupWebGL(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0,0,0,1);
    gl.enable(gl.DEPTH_TEST);
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    if (!program || program === -1) {
        alert("Shader program failed to initialize. Check your shaders for errors.");
        return;
    }
    gl.useProgram(program);
    // Check for GL errors after program use
    let err = gl.getError();
    if (err !== gl.NO_ERROR) {
        alert('WebGL error after useProgram: ' + err);
        return;
    }
    // Load bunny mesh
    let bunny = await loadPLY("bun_zipper.ply");
    for (let c = 0; c < bunny.colors.length; c += 3) {
        bunny.colors[c] = 1.0;
        bunny.colors[c+1] = 1.0;
        bunny.colors[c+2] = 1.0;
    }
    sceneObjects = [];
            // Add bunny in center, larger and slightly forward for better lighting
            sceneObjects.push(createObject(bunny, mult(translate(0,0,0.5), scalem(2.5,2.5,2.5))));
    // Add room and cubes around bunny
    buildRoom();
    addGravityObjects();
    // Set camera to fixed position
    cameraPos = [0, 0, 8];
    // Start animation loop for 3D rotation
    let angle = 0;
    function animate() {
        angle += 0.01;
        // Rotate camera around Y axis
        cameraPos[0] = 8 * Math.sin(angle);
        cameraPos[2] = 8 * Math.cos(angle);
        render();
        requestAnimationFrame(animate);
    }
    animate();
}

// ---------------- CUBE ----------------

function createCube(size=1, color=[0.5,0.5,1]){
    let s = size/2;
    // 8 vertices
    let positions = [
        [-s,-s,-s], [s,-s,-s], [s,s,-s], [-s,s,-s],
        [-s,-s,s],  [s,-s,s],  [s,s,s],  [-s,s,s]
    ];
    // 12 triangles (two per face)
    let faces = [
        [0,1,2], [0,2,3], // back
        [4,5,6], [4,6,7], // front
        [0,4,7], [0,7,3], // left
        [1,5,6], [1,6,2], // right
        [3,2,6], [3,6,7], // top
        [0,1,5], [0,5,4]  // bottom
    ];
    let v = [], c = [], n = [];
    for(let f=0; f<faces.length; ++f){
        let a = positions[faces[f][0]];
        let b = positions[faces[f][1]];
        let c0 = positions[faces[f][2]];
        // Compute face normal
        let ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
        let vx = c0[0]-a[0], vy = c0[1]-a[1], vz = c0[2]-a[2];
        let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
        let len = Math.sqrt(nx*nx+ny*ny+nz*nz);
        nx/=len; ny/=len; nz/=len;
        // Push triangle
        for(let j=0;j<3;++j){
            v.push(...positions[faces[f][j]]);
            c.push(...color);
            n.push(nx,ny,nz);
        }
    }
    return {vertices:v, colors:c, normals:n};
}

// ---------------- ROOM ----------------

// --- Minimal transform test: three cubes ---
function buildRoom(){
    // Center cube (blue)
        let center = createCube(1, [0.2,0.2,0.8]);
        sceneObjects.push(createObject(center, mult(translate(2.5,0,0), scalem(1.5,1.5,1.5))));
        let left = createCube(1, [0.8,0.2,0.2]);
        sceneObjects.push(createObject(left, mult(translate(-2.5,0,0), scalem(1.5,1.5,1.5))));
        let up = createCube(1, [0.2,0.8,0.2]);
        sceneObjects.push(createObject(up, mult(translate(0,2.5,0), scalem(1.5,1.5,1.5))));
        // Room dimensions
        const roomSize = 14;
        const roomHeight = 40;
        const wallThickness = 0.08;
        const wallColor = [0.7, 0.7, 0.9];
        const floorColor = [0.8, 0.8, 0.7];
        const ceilingColor = [0.7, 0.9, 0.8];

        // Floor (flush with bottom boundary)
        let floor = createCube(1, floorColor);
        sceneObjects.push(createObject(floor, mult(translate(0, -roomHeight/2 + wallThickness, 0), scalem(roomSize, wallThickness, roomSize))));

        // Ceiling (flush with top boundary)
        let ceiling = createCube(1, ceilingColor);
        sceneObjects.push(createObject(ceiling, mult(translate(0, roomHeight/2 - wallThickness, 0), scalem(roomSize, wallThickness, roomSize))));

        // (Back wall removed for full visibility)

        // (Front wall removed for visibility)


}

// ---------------- GRAVITY OBJECTS ----------------

function addGravityObjects(){

    let floorObj = createCube(1);
    sceneObjects.push(createObject(floorObj, translate(0,-1,0)));

    let wallObj = createCube(1);
    sceneObjects.push(createObject(wallObj,
        mult(translate(0,0,-3), rotate(90,[1,0,0]))
    ));

    let ceilingObj = createCube(1);
    sceneObjects.push(createObject(ceilingObj,
        mult(translate(0,1,0), rotate(180,[1,0,0]))
    ));
}

// ---------------- CAMERA ----------------

// Returns a standard lookAt view matrix
function lookAt(eye, at, up) {
    var z = normalize([
        eye[0] - at[0],
        eye[1] - at[1],
        eye[2] - at[2]
    ]);
    var x = normalize([
        up[1]*z[2] - up[2]*z[1],
        up[2]*z[0] - up[0]*z[2],
        up[0]*z[1] - up[1]*z[0]
    ]);
    var y = [
        z[1]*x[2] - z[2]*x[1],
        z[2]*x[0] - z[0]*x[2],
        z[0]*x[1] - z[1]*x[0]
    ];
    return [
        [x[0], y[0], z[0], 0],
        [x[1], y[1], z[1], 0],
        [x[2], y[2], z[2], 0],
        [
            -(x[0]*eye[0] + x[1]*eye[1] + x[2]*eye[2]),
            -(y[0]*eye[0] + y[1]*eye[1] + y[2]*eye[2]),
            -(z[0]*eye[0] + z[1]*eye[1] + z[2]*eye[2]),
            1
        ]
    ];
}

function getViewMatrix() {
    // Camera at (0,0,8), looking at (0,0,0), up is +Y
    return lookAt(cameraPos, [0,0,0], [0,1,0]);
}

// ---------------- CONTROLS ----------------

function keyHandler(e){
    let needsRender = false;
    switch(e.key){
        // movement
        case "w": cameraPos[2]-=speed; needsRender = true; break;
        case "s": cameraPos[2]+=speed; needsRender = true; break;
        case "a": cameraPos[0]-=speed; needsRender = true; break;
        case "d": cameraPos[0]+=speed; needsRender = true; break;
        case "ArrowLeft": yaw-=0.1; needsRender = true; break;
        case "ArrowRight": yaw+=0.1; needsRender = true; break;
        // shading modes
        case "1": shadingMode = 1; needsRender = true; break; // wireframe
        case "2": shadingMode = 2; needsRender = true; break; // flat
        case "3": shadingMode = 3; needsRender = true; break; // smooth
        // speed control
        case "+": speed += 0.1; needsRender = true; break;
        case "-": speed = Math.max(0.1, speed - 0.1); needsRender = true; break;
    }
    if (needsRender) render();
}

// ---------------- RENDER ----------------

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const posLoc = gl.getAttribLocation(program, "aPosition");
    const colLoc = gl.getAttribLocation(program, "aColor");
    const normLoc = gl.getAttribLocation(program, "aNormal");

    const modelLoc = gl.getUniformLocation(program, "uModel");
    const viewLoc = gl.getUniformLocation(program, "uView");
    const projLoc = gl.getUniformLocation(program, "uProj");
    const normalLoc = gl.getUniformLocation(program, "uNormalMatrix");

    gl.uniform3fv(gl.getUniformLocation(program, "uLightDir"), LIGHT_DIR);
    gl.uniform1f(gl.getUniformLocation(program, "uAmbient"), AMBIENT);

    // Perspective projection
    let aspect = gl.canvas.width / gl.canvas.height;
    let proj = perspective(60, aspect, 0.1, 100.0);
    gl.uniformMatrix4fv(projLoc, false, flatten(proj));

    let view = getViewMatrix();
    gl.uniformMatrix4fv(viewLoc, false, flatten(view));

    for (let obj of sceneObjects) {
        // Position buffer
        let vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.vertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(posLoc);

        // Color buffer
        let cBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.colors), gl.STATIC_DRAW);
        gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(colLoc);

        // Normal buffer
        let nBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.normals), gl.STATIC_DRAW);
        gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normLoc);

        // Debug: log the structure of obj.transform before flatten
        try {
            console.log('obj.transform:', JSON.stringify(obj.transform));
        } catch (e) {
            console.log('obj.transform (circular or too deep)', obj.transform);
        }
        const flatMatrix = flatten(obj.transform);
        console.log('modelLoc:', modelLoc, 'flatMatrix:', flatMatrix, 'length:', flatMatrix.length);
        gl.uniformMatrix4fv(modelLoc, false, flatMatrix);

        // Set normal matrix (upper-left 3x3 of model matrix)
        let m = obj.transform;
        let normalMatrix = [
            m[0][0], m[0][1], m[0][2],
            m[1][0], m[1][1], m[1][2],
            m[2][0], m[2][1], m[2][2]
        ];
        gl.uniformMatrix3fv(normalLoc, false, new Float32Array(normalMatrix));

        if (obj.indices && obj.indices.length > 0) {
            // Indexed drawing for objects with indices (like bunny)
            console.log('obj.indices length:', obj.indices.length, 'sample:', obj.indices.slice(0, 20));
            let indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            let maxIndex = Math.max(...obj.indices);
            if (maxIndex > 65535) {
                // Need 32-bit indices
                let ext = gl.getExtension("OES_element_index_uint");
                if (!ext) {
                    alert("WebGL extension OES_element_index_uint is not supported! Cannot render large meshes like the bunny.");
                    console.error("OES_element_index_uint not supported, skipping drawElements for this object.");
                    continue;
                }
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(obj.indices), gl.STATIC_DRAW);
                gl.drawElements(gl.TRIANGLES, obj.indices.length, gl.UNSIGNED_INT, 0);
            } else {
                // 16-bit indices are sufficient
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(obj.indices), gl.STATIC_DRAW);
                gl.drawElements(gl.TRIANGLES, obj.indices.length, gl.UNSIGNED_SHORT, 0);
            }
        } else {
            // Non-indexed drawing for cubes/room
            gl.drawArrays(gl.TRIANGLES, 0, obj.vertices.length / 3);
        }
    }

    // DEBUG: Print GL errors after render
    let err = gl.getError();
    if (err !== gl.NO_ERROR) {
        console.error('WebGL error:', err);
    }
}

// Fallback: define scalem here if not found (for debugging)
if (typeof scalem === 'undefined') {
    function scalem(x, y, z) {
        return [
            [x, 0, 0, 0],
            [0, y, 0, 0],
            [0, 0, z, 0],
            [0, 0, 0, 1]
        ];
    }
    window.scalem = scalem;
}