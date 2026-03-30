"use strict";
// ============================================================
// PHYSICS.JS — Gravity Simulation Engine
//
// ROOM COORDINATE SYSTEM (right-handed):
//   X-axis: Left(-) to Right(+)   | walls at x = ±roomHalfW
//   Y-axis: Floor(0) to Ceiling(+) | floor y=0, ceiling y=roomHeight
//   Z-axis: Back(-) to Front(+)    | walls at z = ±roomHalfD
//
// GRAVITY DIRECTIONS (always in room/world space):
//   Down  = [0, -1, 0]  → objects fall toward floor  (y=0)
//   Up    = [0, +1, 0]  → objects push toward ceiling (y=roomHeight)
//   Left  = [-1, 0, 0]  → objects push toward left wall
//   Right = [+1, 0, 0]  → objects push toward right wall
//   Back  = [0, 0, -1]  → objects push toward back wall
//   Front = [0, 0, +1]  → objects push toward front wall
// ============================================================

var GPhysics = {
    bodies: [],

    // Gravity state
    gravity: [0, 0, 0],
    gravityMag: 0.0,
    gravityDir: [0, -1, 0],

    // Room bounds (set by app.js during init)
    roomHalfW: 8.0,
    roomHalfD: 8.0,
    roomHeight: 10.0,

    // Physics tuning
    restitution: 0.25,
    friction: 0.80,
    airDrag: 0.998,
    bounceThreshold: 0.4,
    maxSpeed: 30.0,         // Hard cap on velocity magnitude
    subSteps: 4,            // Physics sub-steps per frame (prevents tunneling)

    // ======================== CREATE BODY ========================
    createBody: function(mesh, position, scale, rotationSpeed) {
        return {
            position: [position[0], position[1], position[2]],
            velocity: [
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6
            ],
            rotation: [Math.random()*360, Math.random()*360, Math.random()*360],
            angularVelocity: [
                (Math.random() - 0.5) * (rotationSpeed || 30),
                (Math.random() - 0.5) * (rotationSpeed || 30),
                (Math.random() - 0.5) * (rotationSpeed || 30)
            ],
            scale: scale || 1.0,
            radius: (mesh.boundingRadius || 1.0) * (scale || 1.0),
            initialPosition: [position[0], position[1], position[2]]
        };
    },

    // ======================== SET GRAVITY ========================
    setGravity: function(direction, magnitude) {
        var wasActive = this.gravityMag > 0.1;
        var isActive  = magnitude > 0.1;

        this.gravityDir = [direction[0], direction[1], direction[2]];
        this.gravityMag = magnitude;
        this.gravity = [
            direction[0] * magnitude,
            direction[1] * magnitude,
            direction[2] * magnitude
        ];

        // TRANSITION: Gravity OFF → ON — zero out drift for unanimous falling
        if (!wasActive && isActive) {
            for (var i = 0; i < this.bodies.length; i++) {
                this.bodies[i].velocity = [0, 0, 0];
            }
        }

        // TRANSITION: Gravity ON → OFF — bounce objects away from resting surface
        if (wasActive && !isActive) {
            this._releaseToZeroG();
        }
    },

    _releaseToZeroG: function() {
        for (var i = 0; i < this.bodies.length; i++) {
            var body = this.bodies[i];
            var r = body.radius;
            var kickX = 0, kickY = 0, kickZ = 0;
            var kick = 2.0 + Math.random() * 1.5;

            if (body.position[1] <= r + 0.2)                   kickY =  kick;
            if (body.position[1] >= this.roomHeight - r - 0.2)  kickY = -kick;
            if (body.position[0] <= -this.roomHalfW + r + 0.2)  kickX =  kick;
            if (body.position[0] >= this.roomHalfW - r - 0.2)   kickX = -kick;
            if (body.position[2] <= -this.roomHalfD + r + 0.2)  kickZ =  kick;
            if (body.position[2] >= this.roomHalfD - r - 0.2)   kickZ = -kick;

            body.velocity[0] = kickX + (Math.random() - 0.5) * 0.5;
            body.velocity[1] = kickY + (Math.random() - 0.5) * 0.5;
            body.velocity[2] = kickZ + (Math.random() - 0.5) * 0.5;

            body.angularVelocity = [
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            ];
        }
    },

    // ======================== MAIN UPDATE ========================
    // Uses sub-stepping: divides each frame into multiple small steps.
    // This prevents objects from tunneling through walls even at high speed.
    update: function(dt) {
        if (dt > 0.05) dt = 0.05;

        var steps = this.subSteps;
        var subDt = dt / steps;

        for (var step = 0; step < steps; step++) {
            this._stepOnce(subDt);
        }
    },

    // Single physics sub-step
    _stepOnce: function(dt) {
        var hasGravity = this.gravityMag > 0.1;

        // --- Integrate velocities and positions ---
        for (var i = 0; i < this.bodies.length; i++) {
            var body = this.bodies[i];

            // Apply gravity
            body.velocity[0] += this.gravity[0] * dt;
            body.velocity[1] += this.gravity[1] * dt;
            body.velocity[2] += this.gravity[2] * dt;

            // Air drag
            body.velocity[0] *= this.airDrag;
            body.velocity[1] *= this.airDrag;
            body.velocity[2] *= this.airDrag;

            // Clamp velocity magnitude (prevents explosion)
            var speed = Math.sqrt(
                body.velocity[0] * body.velocity[0] +
                body.velocity[1] * body.velocity[1] +
                body.velocity[2] * body.velocity[2]
            );
            if (speed > this.maxSpeed) {
                var scale = this.maxSpeed / speed;
                body.velocity[0] *= scale;
                body.velocity[1] *= scale;
                body.velocity[2] *= scale;
            }

            // Move
            body.position[0] += body.velocity[0] * dt;
            body.position[1] += body.velocity[1] * dt;
            body.position[2] += body.velocity[2] * dt;

            // Rotation
            body.rotation[0] += body.angularVelocity[0] * dt;
            body.rotation[1] += body.angularVelocity[1] * dt;
            body.rotation[2] += body.angularVelocity[2] * dt;

            // Spin damping when nearly at rest
            if (hasGravity && speed < 0.5) {
                body.angularVelocity[0] *= 0.95;
                body.angularVelocity[1] *= 0.95;
                body.angularVelocity[2] *= 0.95;
            }

            // IMMEDIATE wall clamp after movement (first pass)
            this._clampToRoom(body);
        }

        // --- Object-object collisions ---
        this._collideObjects();

        // --- Wall clamp AGAIN after collisions (final authority) ---
        for (var i = 0; i < this.bodies.length; i++) {
            this._clampToRoom(this.bodies[i]);
        }
    },

    // ======================== WALL COLLISION ========================
    // Guarantees every body stays STRICTLY inside the room.
    _clampToRoom: function(body) {
        var r = body.radius;
        var hw = this.roomHalfW;
        var hd = this.roomHalfD;
        var rh = this.roomHeight;
        var rest = this.restitution;
        var fric = this.friction;
        var thresh = this.bounceThreshold;

        // Floor (y minimum = r)
        if (body.position[1] < r) {
            body.position[1] = r;
            if (body.velocity[1] < 0) {
                body.velocity[1] = Math.abs(body.velocity[1]) * rest;
                if (body.velocity[1] < thresh) body.velocity[1] = 0;
                body.velocity[0] *= fric;
                body.velocity[2] *= fric;
            }
        }

        // Ceiling (y maximum = rh - r)
        if (body.position[1] > rh - r) {
            body.position[1] = rh - r;
            if (body.velocity[1] > 0) {
                body.velocity[1] = -Math.abs(body.velocity[1]) * rest;
                if (Math.abs(body.velocity[1]) < thresh) body.velocity[1] = 0;
                body.velocity[0] *= fric;
                body.velocity[2] *= fric;
            }
        }

        // Left wall (x minimum = -hw + r)
        if (body.position[0] < -hw + r) {
            body.position[0] = -hw + r;
            if (body.velocity[0] < 0) {
                body.velocity[0] = Math.abs(body.velocity[0]) * rest;
                if (body.velocity[0] < thresh) body.velocity[0] = 0;
                body.velocity[1] *= fric;
                body.velocity[2] *= fric;
            }
        }

        // Right wall (x maximum = hw - r)
        if (body.position[0] > hw - r) {
            body.position[0] = hw - r;
            if (body.velocity[0] > 0) {
                body.velocity[0] = -Math.abs(body.velocity[0]) * rest;
                if (Math.abs(body.velocity[0]) < thresh) body.velocity[0] = 0;
                body.velocity[1] *= fric;
                body.velocity[2] *= fric;
            }
        }

        // Back wall (z minimum = -hd + r)
        if (body.position[2] < -hd + r) {
            body.position[2] = -hd + r;
            if (body.velocity[2] < 0) {
                body.velocity[2] = Math.abs(body.velocity[2]) * rest;
                if (body.velocity[2] < thresh) body.velocity[2] = 0;
                body.velocity[0] *= fric;
                body.velocity[1] *= fric;
            }
        }

        // Front wall (z maximum = hd - r)
        if (body.position[2] > hd - r) {
            body.position[2] = hd - r;
            if (body.velocity[2] > 0) {
                body.velocity[2] = -Math.abs(body.velocity[2]) * rest;
                if (Math.abs(body.velocity[2]) < thresh) body.velocity[2] = 0;
                body.velocity[0] *= fric;
                body.velocity[1] *= fric;
            }
        }
    },

    // ======================== OBJECT-OBJECT COLLISION ========================
    _collideObjects: function() {
        var hw = this.roomHalfW, hd = this.roomHalfD, rh = this.roomHeight;

        for (var i = 0; i < this.bodies.length; i++) {
            for (var j = i + 1; j < this.bodies.length; j++) {
                var a = this.bodies[i], b = this.bodies[j];
                var dx = b.position[0] - a.position[0];
                var dy = b.position[1] - a.position[1];
                var dz = b.position[2] - a.position[2];
                var distSq = dx*dx + dy*dy + dz*dz;
                var minDist = a.radius + b.radius;

                if (distSq < minDist * minDist && distSq > 0.0001) {
                    var dist = Math.sqrt(distSq);
                    var nx = dx / dist;
                    var ny = dy / dist;
                    var nz = dz / dist;

                    // Separate objects — but CLAMP separation so neither goes outside room
                    var overlap = (minDist - dist) * 0.52;

                    // Compute new positions after push
                    var ax = a.position[0] - nx * overlap;
                    var ay = a.position[1] - ny * overlap;
                    var az = a.position[2] - nz * overlap;
                    var bx = b.position[0] + nx * overlap;
                    var by = b.position[1] + ny * overlap;
                    var bz = b.position[2] + nz * overlap;

                    // Clamp pushed positions to room bounds
                    var ar = a.radius, br = b.radius;
                    ax = Math.max(-hw + ar, Math.min(hw - ar, ax));
                    ay = Math.max(ar,       Math.min(rh - ar, ay));
                    az = Math.max(-hd + ar, Math.min(hd - ar, az));
                    bx = Math.max(-hw + br, Math.min(hw - br, bx));
                    by = Math.max(br,       Math.min(rh - br, by));
                    bz = Math.max(-hd + br, Math.min(hd - br, bz));

                    a.position[0] = ax;
                    a.position[1] = ay;
                    a.position[2] = az;
                    b.position[0] = bx;
                    b.position[1] = by;
                    b.position[2] = bz;

                    // Velocity exchange along collision normal
                    var dvx = a.velocity[0] - b.velocity[0];
                    var dvy = a.velocity[1] - b.velocity[1];
                    var dvz = a.velocity[2] - b.velocity[2];
                    var dvDotN = dvx * nx + dvy * ny + dvz * nz;

                    if (dvDotN > 0) {
                        var impulse = dvDotN * 0.7;
                        a.velocity[0] -= impulse * nx;
                        a.velocity[1] -= impulse * ny;
                        a.velocity[2] -= impulse * nz;
                        b.velocity[0] += impulse * nx;
                        b.velocity[1] += impulse * ny;
                        b.velocity[2] += impulse * nz;
                    }
                }
            }
        }
    },

    // ======================== RESET ========================
    reset: function() {
        for (var i = 0; i < this.bodies.length; i++) {
            var body = this.bodies[i];
            body.position[0] = body.initialPosition[0];
            body.position[1] = body.initialPosition[1];
            body.position[2] = body.initialPosition[2];
            body.velocity = [
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6
            ];
            body.angularVelocity = [
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            ];
        }
    }
};
