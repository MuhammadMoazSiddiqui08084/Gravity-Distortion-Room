"use strict";
// ============================================================
// CAMERA.JS — First-Person Camera with Pitch/Roll/Yaw (WebGL)
// ============================================================

var GCamera = {
    // Position in world space
    position: [0, 1.7, 0],
    // Euler angles in degrees
    pitch: 0,    // rotation about X axis (look up/down)
    yaw: -90,    // rotation about Y axis (look left/right)
    roll: 0,     // rotation about Z axis (tilt)
    // Projection parameters
    fov: 60,
    near: 0.1,
    far: 100.0,
    // View bound offsets (for assignment requirement: adjust left/right/top/bottom/near/far)
    viewLeft: 0,
    viewRight: 0,
    viewTop: 0,
    viewBottom: 0,
    // Movement
    speed: 5.0,
    sensitivity: 0.15,
    rollSpeed: 45.0,  // degrees per second
    // Room constraints
    roomBounds: { minX:-7.5, maxX:7.5, minY:0.5, maxY:9.5, minZ:-7.5, maxZ:7.5 },
    // State
    keys: {},

    // Get the forward direction (where camera looks in XZ plane)
    getForward: function() {
        var yawRad = radians(this.yaw);
        return [Math.cos(yawRad), 0, Math.sin(yawRad)];
    },

    // Get the right direction
    getRight: function() {
        var yawRad = radians(this.yaw);
        return [-Math.sin(yawRad), 0, Math.cos(yawRad)];
    },

    // Get the look direction (includes pitch)
    getLookDir: function() {
        var yawRad = radians(this.yaw);
        var pitchRad = radians(this.pitch);
        return [
            Math.cos(pitchRad) * Math.cos(yawRad),
            Math.sin(pitchRad),
            Math.cos(pitchRad) * Math.sin(yawRad)
        ];
    },

    // Handle mouse movement for pitch and yaw
    onMouseMove: function(dx, dy) {
        this.yaw   += dx * this.sensitivity;
        this.pitch -= dy * this.sensitivity;
        // Clamp pitch to avoid flipping
        if (this.pitch > 89) this.pitch = 89;
        if (this.pitch < -89) this.pitch = -89;
    },

    // Update camera position based on held keys
    update: function(dt) {
        var moveSpeed = this.speed * dt;
        var fwd = this.getForward();
        var right = this.getRight();

        if (this.keys["w"] || this.keys["W"]) {
            this.position[0] += fwd[0] * moveSpeed;
            this.position[2] += fwd[2] * moveSpeed;
        }
        if (this.keys["s"] || this.keys["S"]) {
            this.position[0] -= fwd[0] * moveSpeed;
            this.position[2] -= fwd[2] * moveSpeed;
        }
        if (this.keys["a"] || this.keys["A"]) {
            this.position[0] -= right[0] * moveSpeed;
            this.position[2] -= right[2] * moveSpeed;
        }
        if (this.keys["d"] || this.keys["D"]) {
            this.position[0] += right[0] * moveSpeed;
            this.position[2] += right[2] * moveSpeed;
        }
        if (this.keys[" "]) { // Space = move up
            this.position[1] += moveSpeed;
        }
        if (this.keys["Shift"]) { // Shift = move down
            this.position[1] -= moveSpeed;
        }
        // Roll with Q/E
        if (this.keys["q"] || this.keys["Q"]) {
            this.roll -= this.rollSpeed * dt;
        }
        if (this.keys["e"] || this.keys["E"]) {
            this.roll += this.rollSpeed * dt;
        }

        // Clamp position to room bounds
        var b = this.roomBounds;
        this.position[0] = Math.max(b.minX, Math.min(b.maxX, this.position[0]));
        this.position[1] = Math.max(b.minY, Math.min(b.maxY, this.position[1]));
        this.position[2] = Math.max(b.minZ, Math.min(b.maxZ, this.position[2]));
    },

    // Build the view matrix using pitch/yaw/roll
    getViewMatrix: function() {
        var look = this.getLookDir();
        var target = [
            this.position[0] + look[0],
            this.position[1] + look[1],
            this.position[2] + look[2]
        ];
        // Compute up vector with roll
        var rollRad = radians(this.roll);
        var up = [Math.sin(rollRad), Math.cos(rollRad), 0];

        // Build lookAt matrix
        var z = normalize([
            this.position[0] - target[0],
            this.position[1] - target[1],
            this.position[2] - target[2]
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
        var eye = this.position;
        return [
            [x[0], y[0], z[0], 0],
            [x[1], y[1], z[1], 0],
            [x[2], y[2], z[2], 0],
            [-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
             -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
             -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]), 1]
        ];
    },

    // Build perspective projection matrix with adjustable bounds
    getProjectionMatrix: function(aspect) {
        var fovRad = radians(this.fov) / 2.0;
        var top = this.near * Math.tan(fovRad) + this.viewTop;
        var bottom = -this.near * Math.tan(fovRad) + this.viewBottom;
        var right = top * aspect + this.viewRight;
        var left = -top * aspect + this.viewLeft;
        return frustum(left, right, bottom, top, this.near, this.far);
    }
};
