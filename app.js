"use strict";
// Main application bootstrap.
// This file connects the camera, physics, renderer, loaders, and UI events into one render loop.

var gl, program;
// Each scene entry is either a static room mesh or a simulated body driven by physics.
var sceneObjects = [];  // mesh, buffers, body, modelMatrix, isStatic
var lastTime = 0;
var fps = 0, frameCount = 0, fpsTimer = 0;
var pointerLocked = false;

// Room dimensions used by both rendering and physics.
var ROOM_W = 16, ROOM_H = 10, ROOM_D = 16;

// Start-up path: configure WebGL, create all scene content, then kick off animation.
window.onload = async function() {
    var canvas = document.getElementById("glcanvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL not supported."); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.enable(gl.DEPTH_TEST);
    // Backface culling is left disabled so the wireframe and interior room surfaces stay visible.

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    if (!program || program === -1) {
        alert("Shader compilation failed. Check console.");
        return;
    }
    gl.useProgram(program);

    GRenderer.init(gl, program);
    await buildScene();
    setupEventListeners(canvas);
    updateUI();
    lastTime = performance.now() / 1000.0;
    requestAnimationFrame(animate);
};

// Scene construction.
async function buildScene() {
    // Room bounds are used to place walls and to keep physics/camera movement inside the room.
    var hw = ROOM_W/2, hh = ROOM_H, hd = ROOM_D/2;

    // Static room geometry: floor.
    var floor = generateGridFloor(ROOM_W, ROOM_D, 16,
        [0.15, 0.16, 0.22], [0.10, 0.10, 0.15]);
    var floorBuf = GRenderer.createBuffers(floor);
    sceneObjects.push({ buffers: floorBuf, modelMatrix: mat4(), isStatic: true });

    // Static room geometry: ceiling.
    var ceiling = generateRoomQuadXZ(ROOM_W, ROOM_D, [0.08, 0.08, 0.12], false);
    var ceilingBuf = GRenderer.createBuffers(ceiling);
    sceneObjects.push({ buffers: ceilingBuf, modelMatrix: translate(0, ROOM_H, 0), isStatic: true });

    // Static room geometry: back wall.
    var backWall = generateRoomQuadXY(ROOM_W, ROOM_H, [0.12, 0.11, 0.18], true);
    var backBuf = GRenderer.createBuffers(backWall);
    sceneObjects.push({ buffers: backBuf, modelMatrix: translate(0, ROOM_H/2, -hd), isStatic: true });

    // Static room geometry: front wall.
    var frontWall = generateRoomQuadXY(ROOM_W, ROOM_H, [0.12, 0.11, 0.18], false);
    var frontBuf = GRenderer.createBuffers(frontWall);
    sceneObjects.push({ buffers: frontBuf, modelMatrix: translate(0, ROOM_H/2, hd), isStatic: true });

    // Static room geometry: left wall.
    var leftWall = generateRoomQuadZY(ROOM_D, ROOM_H, [0.13, 0.12, 0.19], true);
    var leftBuf = GRenderer.createBuffers(leftWall);
    sceneObjects.push({ buffers: leftBuf, modelMatrix: translate(-hw, ROOM_H/2, 0), isStatic: true });

    // Static room geometry: right wall.
    var rightWall = generateRoomQuadZY(ROOM_D, ROOM_H, [0.13, 0.12, 0.19], false);
    var rightBuf = GRenderer.createBuffers(rightWall);
    sceneObjects.push({ buffers: rightBuf, modelMatrix: translate(hw, ROOM_H/2, 0), isStatic: true });

    // Dynamic objects combine procedural meshes and imported PLY meshes.
    // The same list drives geometry creation, physics body creation, and spawn placement.
    var objects = [
        { gen: function(){return generateCube(1.2, [0.0, 0.85, 0.95]);}, pos:[2, 6, -2], scale:1.0 },
        { gen: function(){return generateCube(0.8, [0.95, 0.75, 0.1]);}, pos:[-3, 4, 3], scale:1.0 },
        { gen: function(){return generateCube(1.0, [0.3, 0.9, 0.5]);}, pos:[4, 7, 1], scale:0.7 },
        { gen: function(){return generateIcosphere(0.7, 2, [0.9, 0.2, 0.7]);}, pos:[-2, 5, -3], scale:1.0 },
        { gen: function(){return generateIcosphere(0.5, 2, [0.4, 0.95, 0.2]);}, pos:[3, 3, 2], scale:1.0 },
        { gen: function(){return generateIcosphere(0.6, 2, [0.95, 0.6, 0.1]);}, pos:[0, 8, 0], scale:1.0 },
        { gen: function(){return generateTorus(0.6, 0.2, 24, 12, [1.0, 0.45, 0.35]);}, pos:[-4, 7, -1], scale:1.0 },
        { gen: function(){return generateTorus(0.5, 0.15, 20, 10, [0.5, 0.3, 0.95]);}, pos:[1, 2, -4], scale:1.0 },
        { gen: function(){return generateEscherStaircase(16, 0.25, 0.28, 0.7, [0.22, 0.78, 0.75]);}, pos:[0, 5, 0], scale:1.0 },
        { gen: function(){return generateEscherStaircase(24, 0.35, 0.38, 1.1, [0.95, 0.55, 0.15]);}, pos:[-3, 3, 2], scale:1.0 },
        { file: "tetrahedron.ply", color: [0.95, 0.35, 0.40], pos:[5, 5.5, -2], scale:0.85 },
        { file: "cube.ply",        color: [0.15, 0.85, 0.95], pos:[-5, 6.5, 1], scale:0.80 },
        { file: "octahedron.ply",  color: [0.30, 0.90, 0.50], pos:[4, 3.0, 4], scale:0.85 },
        { file: "dodecahedron.ply",color: [0.90, 0.20, 0.70], pos:[-1, 7.8, 4], scale:0.75 },
        { file: "icosahedron.ply", color: [0.95, 0.75, 0.10], pos:[-4, 2.8, -4], scale:0.85 }
    ];

    // Spread spawn points apart so the simulation starts without heavy overlap.
    assignSpawnPositions(objects, hw, hd, ROOM_H);

    // Every dynamic object gets a physics body plus a matching render mesh buffer.
    GPhysics.bodies = [];
    for (var i = 0; i < objects.length; i++) {
        var def = objects[i];
        var mesh;
        if (def.gen) {
            mesh = def.gen();
        } else {
            try {
                mesh = await GPly.loadMesh(def.file, def.color);
            } catch (err) {
                console.error(err);
                mesh = generateCube(1.0, def.color);
            }
        }
        var buf = GRenderer.createBuffers(mesh);
        var body = GPhysics.createBody(mesh, def.pos, def.scale, 30);
        GPhysics.bodies.push(body);
        sceneObjects.push({
            buffers: buf,
            body: body,
            isStatic: false
        });
    }

    // Push room size into physics so wall clamps match the rendered room.
    GPhysics.roomHalfW = hw;
    GPhysics.roomHalfD = hd;
    GPhysics.roomHeight = ROOM_H;

    // Clamp the camera to the same interior bounds used by physics.
    GCamera.roomBounds = {
        minX: -hw + 0.5, maxX: hw - 0.5,
        minY: 0.5, maxY: ROOM_H - 0.5,
        minZ: -hd + 0.5, maxZ: hd - 0.5
    };
    GCamera.position = [0, 5, 6];
    GCamera.yaw = -90;
    GCamera.pitch = -15; // Look slightly down to see objects.
}

// Main animation loop: advance camera and physics, then render the next frame.
function animate(timestamp) {
    var now = performance.now() / 1000.0;
    var dt = now - lastTime;
    lastTime = now;

    // FPS counter updates once per second so the HUD stays readable.
    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 1.0) {
        fps = frameCount;
        frameCount = 0;
        fpsTimer = 0;
        updateFPS();
    }

    // Update simulation state before drawing.
    GCamera.update(dt);
    GPhysics.update(dt);

    // Render the whole scene with the latest transforms.
    render();

    requestAnimationFrame(animate);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Build the current camera matrices from the live camera state.
    var aspect = gl.canvas.width / gl.canvas.height;
    var viewMatrix = GCamera.getViewMatrix();
    var projMatrix = GCamera.getProjectionMatrix(aspect);

    // Send camera and lighting uniforms once per frame.
    GRenderer.setCamera(viewMatrix, projMatrix, GCamera.position);
    GRenderer.setLighting();

    // Draw every scene object using either a fixed model matrix or physics-driven transform.
    for (var i = 0; i < sceneObjects.length; i++) {
        var obj = sceneObjects[i];
        var modelMatrix;

        if (obj.isStatic) {
            modelMatrix = obj.modelMatrix;
        } else {
            // Build model matrix from the physics body's position, rotation, and scale.
            var body = obj.body;
            var t = translate(body.position[0], body.position[1], body.position[2]);
            var rx = rotate(body.rotation[0], [1,0,0]);
            var ry = rotate(body.rotation[1], [0,1,0]);
            var rz = rotate(body.rotation[2], [0,0,1]);
            var s = scalem(body.scale, body.scale, body.scale);
            modelMatrix = mult(t, mult(rz, mult(ry, mult(rx, s))));
        }

        GRenderer.drawObject(obj.buffers, modelMatrix);
    }
}

// Input and UI event handlers.
function setupEventListeners(canvas) {
    // Keyboard input drives camera movement, shading changes, resets, and help toggling.
    document.addEventListener("keydown", function(e) {
        GCamera.keys[e.key] = true;

        // Shading mode changes map directly to renderer state.
        if (e.key === "1") { GRenderer.shadingMode = 1; updateUI(); }
        if (e.key === "2") { GRenderer.shadingMode = 2; updateUI(); }
        if (e.key === "3") { GRenderer.shadingMode = 3; updateUI(); }

        // Camera speed controls update both behavior and HUD display.
        if (e.key === "=" || e.key === "+") {
            GCamera.speed = Math.min(20, GCamera.speed + 1);
            updateUI();
        }
        if (e.key === "-" || e.key === "_") {
            GCamera.speed = Math.max(1, GCamera.speed - 1);
            updateUI();
        }

        // Reset the simulated bodies back to their original spawn points.
        if (e.key === "r" || e.key === "R") {
            GPhysics.reset();
        }

        // Toggle help panel visibility without affecting the simulation.
        if (e.key === "h" || e.key === "H") {
            var help = document.getElementById("help-panel");
            help.style.display = (help.style.display === "none") ? "block" : "none";
        }

        // Prevent page scrolling when using movement keys.
        if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) >= 0) {
            e.preventDefault();
        }
    });

    // Key releases clear the movement state so motion stops when the key is lifted.
    document.addEventListener("keyup", function(e) {
        GCamera.keys[e.key] = false;
    });

    // Pointer lock lets the mouse act like an infinite-look camera.
    canvas.addEventListener("click", function() {
        canvas.requestPointerLock();
    });

    // The prompt mirrors whether the pointer is locked or not.
    document.addEventListener("pointerlockchange", function() {
        pointerLocked = (document.pointerLockElement === canvas);
        // Show or hide the click-to-enter prompt depending on pointer lock state.
        var prompt = document.getElementById("click-prompt");
        if (pointerLocked) {
            prompt.classList.add("hidden");
        } else {
            prompt.classList.remove("hidden");
        }
    });

    // Mouse movement becomes yaw/pitch input only while pointer lock is active.
    document.addEventListener("mousemove", function(e) {
        if (pointerLocked) {
            GCamera.onMouseMove(e.movementX, e.movementY);
        }
    });

    // Gravity magnitude slider feeds directly into the physics system.
    var slider = document.getElementById("gravity-slider");
    if (slider) {
        slider.addEventListener("input", function() {
            var val = parseFloat(this.value);
            GPhysics.setGravity(GPhysics.gravityDir, val);
            updateUI();
        });
    }

    // Direction buttons swap gravity direction without changing the magnitude.
    var dirButtons = document.querySelectorAll("[data-gravity-dir]");
    for (var i = 0; i < dirButtons.length; i++) {
        dirButtons[i].addEventListener("click", function() {
            var dir = this.getAttribute("data-gravity-dir").split(",").map(Number);
            GPhysics.setGravity(dir, GPhysics.gravityMag);
            // Highlight the active direction button so the HUD matches the simulation.
            var all = document.querySelectorAll("[data-gravity-dir]");
            for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
            this.classList.add("active");
            updateUI();
        });
    }

    // Reset button returns both the physics state and gravity settings to defaults.
    var resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", function() {
            GPhysics.reset();
            GPhysics.setGravity([0,-1,0], 0);
            var slider = document.getElementById("gravity-slider");
            if (slider) slider.value = 0;
            updateUI();
        });
    }

    // View sliders keep camera projection state in sync with the HUD.
    var viewControls = ["fov-slider", "near-slider", "far-slider"];
    for (var i = 0; i < viewControls.length; i++) {
        var ctrl = document.getElementById(viewControls[i]);
        if (ctrl) {
            ctrl.addEventListener("input", function() {
                GCamera.fov = parseFloat(document.getElementById("fov-slider").value);
                GCamera.near = parseFloat(document.getElementById("near-slider").value);
                GCamera.far = parseFloat(document.getElementById("far-slider").value);
                updateUI();
            });
        }
    }

    // Keep the canvas and viewport matched to the browser window.
    window.addEventListener("resize", function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    });
}

// HUD helpers keep the DOM synchronized with renderer, camera, and physics state.
function updateUI() {
    var el;
    el = document.getElementById("info-shading");
    if (el) {
        var modes = { 1: "Wireframe", 2: "Flat", 3: "Smooth (Phong)" };
        el.textContent = modes[GRenderer.shadingMode] || "Unknown";
    }
    el = document.getElementById("info-speed");
    if (el) el.textContent = GCamera.speed.toFixed(1);

    el = document.getElementById("info-gravity");
    if (el) el.textContent = GPhysics.gravityMag.toFixed(1) + " m/s²";

    el = document.getElementById("info-fov");
    if (el) el.textContent = GCamera.fov.toFixed(0) + "°";

    el = document.getElementById("info-near");
    if (el) el.textContent = GCamera.near.toFixed(2);

    el = document.getElementById("info-far");
    if (el) el.textContent = GCamera.far.toFixed(1);

    el = document.getElementById("gravity-value");
    if (el) el.textContent = GPhysics.gravityMag.toFixed(1);
}

function updateFPS() {
    var el = document.getElementById("info-fps");
    if (el) el.textContent = fps;
}

// Spawn placement tries to keep bodies separated so the first frames are stable.
function assignSpawnPositions(objects, roomHalfW, roomHalfD, roomHeight) {
    var placed = [];

    for (var i = 0; i < objects.length; i++) {
        var def = objects[i];
        var radius = 0.95 * (def.scale || 1.0);
        var bestPos = def.pos || [0, 5, 0];
        var bestSeparation = -1;

        // Try several random candidates and keep the one with the best clearance.
        for (var attempt = 0; attempt < 40; attempt++) {
            var candidate = [
                randRange(-roomHalfW + 1.4, roomHalfW - 1.4),
                randRange(1.8, roomHeight - 1.2),
                randRange(-roomHalfD + 1.4, roomHalfD - 1.4)
            ];

            var minGap = Infinity;
            for (var j = 0; j < placed.length; j++) {
                var p = placed[j];
                var need = radius + p.radius + 0.9;
                var gap = distance3(candidate, p.pos) - need;
                if (gap < minGap) {
                    minGap = gap;
                }
            }

            if (placed.length === 0) {
                minGap = 999;
            }

            if (minGap > bestSeparation) {
                bestSeparation = minGap;
                bestPos = candidate;
            }

            if (minGap > 0.2) {
                bestPos = candidate;
                break;
            }
        }

        def.pos = bestPos;
        placed.push({ pos: bestPos, radius: radius });
    }
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

// Euclidean distance helper for spawn spacing.
function distance3(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    var dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
