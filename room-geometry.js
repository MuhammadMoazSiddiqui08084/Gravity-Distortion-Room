"use strict";

function generateGridFloor(width, depth, divisions, color1, color2) {
    var pos = [], fn = [], col = [], wp = [];
    var cellW = width / divisions, cellD = depth / divisions;
    var startX = -width / 2, startZ = -depth / 2;
    for (var i = 0; i < divisions; i++) {
        for (var j = 0; j < divisions; j++) {
            var x0 = startX + i * cellW, x1 = x0 + cellW;
            var z0 = startZ + j * cellD, z1 = z0 + cellD;
            var c = ((i + j) % 2 === 0) ? color1 : color2;
            pos.push(x0,0,z0, x1,0,z0, x1,0,z1,  x0,0,z0, x1,0,z1, x0,0,z1);
            for (var k = 0; k < 6; k++) { fn.push(0,1,0); col.push(c[0],c[1],c[2]); }
            wp.push(x0,0,z0, x1,0,z0,  x1,0,z0, x1,0,z1,
                    x1,0,z1, x0,0,z1,  x0,0,z1, x0,0,z0);
        }
    }
    return {
        positions: new Float32Array(pos), flatNormals: new Float32Array(fn),
        smoothNormals: new Float32Array(fn), colors: new Float32Array(col),
        vertexCount: divisions * divisions * 6, wirePositions: new Float32Array(wp),
        wireVertexCount: wp.length / 3, boundingRadius: Math.sqrt(width * width + depth * depth) / 2
    };
}

function generateRoomQuadXZ(width, depth, color, normalDown) {
    var hw = width / 2, hd = depth / 2;
    var ny = normalDown ? -1 : 1;
    var pos;
    if (normalDown) {
        pos = [ -hw,0,-hd,  -hw,0,hd,  hw,0,hd,   -hw,0,-hd,  hw,0,hd,  hw,0,-hd ];
    } else {
        pos = [ -hw,0,-hd,  hw,0,-hd,  hw,0,hd,   -hw,0,-hd,  hw,0,hd,  -hw,0,hd ];
    }
    var nm = [0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0];
    var col = [];
    for (var i = 0; i < 6; i++) col.push(color[0], color[1], color[2]);
    var wp = [ -hw,0,-hd, hw,0,-hd,  hw,0,-hd, hw,0,hd,  hw,0,hd, -hw,0,hd,  -hw,0,hd, -hw,0,-hd ];
    return {
        positions: new Float32Array(pos), flatNormals: new Float32Array(nm),
        smoothNormals: new Float32Array(nm), colors: new Float32Array(col),
        vertexCount: 6, wirePositions: new Float32Array(wp), wireVertexCount: 8,
        boundingRadius: Math.sqrt(hw * hw + hd * hd)
    };
}

function generateRoomQuadXY(width, height, color, facingPosZ) {
    var hw = width / 2, hh = height / 2;
    var nz = facingPosZ ? 1 : -1;
    var pos;
    if (facingPosZ) {
        pos = [ -hw,-hh,0, hw,-hh,0, hw,hh,0,  -hw,-hh,0, hw,hh,0, -hw,hh,0 ];
    } else {
        pos = [ hw,-hh,0, -hw,-hh,0, -hw,hh,0,  hw,-hh,0, -hw,hh,0, hw,hh,0 ];
    }
    var nm = [0,0,nz, 0,0,nz, 0,0,nz, 0,0,nz, 0,0,nz, 0,0,nz];
    var col = [];
    for (var i = 0; i < 6; i++) col.push(color[0], color[1], color[2]);
    var wp = [ -hw,-hh,0, hw,-hh,0, hw,-hh,0, hw,hh,0, hw,hh,0, -hw,hh,0, -hw,hh,0, -hw,-hh,0 ];
    return {
        positions: new Float32Array(pos), flatNormals: new Float32Array(nm),
        smoothNormals: new Float32Array(nm), colors: new Float32Array(col),
        vertexCount: 6, wirePositions: new Float32Array(wp), wireVertexCount: 8,
        boundingRadius: Math.sqrt(hw * hw + hh * hh)
    };
}

function generateRoomQuadZY(depth, height, color, facingPosX) {
    var hd = depth / 2, hh = height / 2;
    var nx = facingPosX ? 1 : -1;
    var pos;
    if (facingPosX) {
        pos = [ 0,-hh,-hd, 0,-hh,hd, 0,hh,hd,  0,-hh,-hd, 0,hh,hd, 0,hh,-hd ];
    } else {
        pos = [ 0,-hh,hd, 0,-hh,-hd, 0,hh,-hd,  0,-hh,hd, 0,hh,-hd, 0,hh,hd ];
    }
    var nm = [nx,0,0, nx,0,0, nx,0,0, nx,0,0, nx,0,0, nx,0,0];
    var col = [];
    for (var i = 0; i < 6; i++) col.push(color[0], color[1], color[2]);
    var wp = [ 0,-hh,-hd, 0,-hh,hd, 0,-hh,hd, 0,hh,hd, 0,hh,hd, 0,hh,-hd, 0,hh,-hd, 0,-hh,-hd ];
    return {
        positions: new Float32Array(pos), flatNormals: new Float32Array(nm),
        smoothNormals: new Float32Array(nm), colors: new Float32Array(col),
        vertexCount: 6, wirePositions: new Float32Array(wp), wireVertexCount: 8,
        boundingRadius: Math.sqrt(hd * hd + hh * hh)
    };
}
