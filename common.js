"use strict";

// Vector constructors.

function vec2(x, y) {
    if (arguments.length !== 2) {
        throw "vec2 requires exactly 2 arguments";
    }
    return [x, y];
}

function vec3(x, y, z) {
    if (arguments.length !== 3) {
        throw "vec3 requires exactly 3 arguments";
    }
    return [x, y, z];
}

function vec4(x, y, z, w) {
    if (arguments.length !== 4) {
        throw "vec4 requires exactly 4 arguments";
    }
    return [x, y, z, w];
}

// Matrix constructors; row-major args stored as column arrays.

function mat2(a, b, c, d) {
    if (arguments.length !== 4) {
        throw "mat2 requires exactly 4 arguments";
    }
    return [
        [a, b],
        [c, d]
    ];
}

function mat3(a, b, c, d, e, f, g, h, i) {
    if (arguments.length !== 9) {
        throw "mat3 requires exactly 9 arguments";
    }
    return [
        [a, b, c],
        [d, e, f],
        [g, h, i]
    ];
}

function mat4(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p) {
    if (arguments.length === 0) {
        return [
            vec4(1, 0, 0, 0),
            vec4(0, 1, 0, 0),
            vec4(0, 0, 1, 0),
            vec4(0, 0, 0, 1)
        ];
    }
    if (arguments.length !== 16) {
        throw "mat4 requires 0 or 16 arguments";
    }
    // Convert row-major args to column arrays.
    return [
        vec4(a, e, i, m),
        vec4(b, f, j, n),
        vec4(c, g, k, o),
        vec4(d, h, l, p)
    ];
}

// Linear interpolation between P and Q with parameter alpha.
function lerp(P, Q, alpha) {
    if (P.length !== Q.length) {
        throw "lerp: P and Q must have same dimension";
    }
    // Compute (1 - alpha) * P + alpha * Q
    let result = [];
    for (let i = 0; i < P.length; i++) {
        result.push(alpha * Q[i] + (1 - alpha) * P[i]);
    }
    return result;
}

// Linear interpolate vectors a and b by t.
function mix(a, b, t) {
    if (a.length !== b.length) {
        throw "mix: dimension mismatch";
    }
    var out = [];
    for (var i = 0; i < a.length; i++) {
        out.push((1 - t) * a[i] + t * b[i]);
    }
    return out;
}

// Convert degrees to radians.
function radians(degrees) {
    return degrees * Math.PI / 180.0;
}

// Normalize a vector to unit length.
function normalize(v) {
    var sum = 0.0;
    for (var i = 0; i < v.length; i++) {
        sum += v[i] * v[i];
    }
    var len = Math.sqrt(sum);
    if (len === 0) {
        return v.slice();
    }
    var out = [];
    for (var j = 0; j < v.length; j++) {
        out.push(v[j] / len);
    }
    return out;
}

// Multiply two 4x4 matrices.
function mult(a, b) {
    // Standard 4x4 matrix multiplication (column-major, returns 4x4 array)
    var result = [];
    for (var i = 0; i < 4; ++i) {
        result[i] = [];
        for (var j = 0; j < 4; ++j) {
            var sum = 0;
            for (var k = 0; k < 4; ++k) {
                sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}

// Build a translation matrix.
function translate(x, y, z) {
    if (Array.isArray(x)) {
        y = x[1];
        z = x[2];
        x = x[0];
    }
    return mat4(
        1, 0, 0, x,
        0, 1, 0, y,
        0, 0, 1, z,
        0, 0, 0, 1
    );
}

// Build a rotation matrix around an arbitrary axis.
function rotate(angle, axis) {
    var v = normalize(axis);
    var x = v[0];
    var y = v[1];
    var z = v[2];

    var c = Math.cos(radians(angle));
    var s = Math.sin(radians(angle));
    var omc = 1.0 - c;

    return mat4(
        x * x * omc + c,     x * y * omc - z * s, x * z * omc + y * s, 0,
        y * x * omc + z * s, y * y * omc + c,     y * z * omc - x * s, 0,
        z * x * omc - y * s, z * y * omc + x * s, z * z * omc + c,     0,
        0, 0, 0, 1
    );
}

// Build a perspective projection matrix.
function perspective(fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(radians(fovy) / 2.0);
    var d = near - far;

    return mat4(
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / d, (2 * far * near) / d,
        0, 0, -1, 0
    );
}

// Build a frustum projection matrix with explicit bounds.
function frustum(left, right, bottom, top, near, far) {
    var rl = right - left;
    var tb = top - bottom;
    var fn = far - near;
    return mat4(
        2*near/rl, 0, (right+left)/rl, 0,
        0, 2*near/tb, (top+bottom)/tb, 0,
        0, 0, -(far+near)/fn, -2*far*near/fn,
        0, 0, -1, 0
    );
}

// Map point X in segment PQ onto segment AB.
function map_point(P, Q, A, B, X) {
    if (P.length !== Q.length || A.length !== B.length) {
        throw "map_point: dimension mismatch";
    }
    // Find alpha such that X = (1 - alpha) * P + alpha * Q
    let alpha = null;

    for (let i = 0; i < P.length; i++) {
        if (Q[i] !== P[i]) {
            alpha = (X[i] - P[i]) / (Q[i] - P[i]);
            break;
        }
    }

    if (alpha === null) {
        throw "map_point: cannot determine alpha";
    }

    return lerp(A, B, alpha);
}

// Build a scaling matrix (like scalem in mesh.js)
function scalem(x, y, z) {
    return mat4(
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    );
}

// Make all math helpers globally available for mesh.js
window.scalem = scalem;
window.mat4 = mat4;
window.translate = translate;
window.rotate = rotate;
window.perspective = perspective;
window.flatten = flatten;
window.mult = mult;

// Flatten nested arrays into a Float32Array for WebGL buffers.
function flatten(data) {
    if (data instanceof Float32Array) { return data; }
    if (!Array.isArray(data)) { return new Float32Array([data]); }
    if (!Array.isArray(data[0])) { return new Float32Array(data); }
    var out = [];
    for (var i = 0; i < data.length; i++) {
        if (Array.isArray(data[i])) {
            for (var j = 0; j < data[i].length; j++) {
                out.push(data[i][j]);
            }
        } else {
            out.push(data[i]);
        }
    }
    return new Float32Array(out);
}
