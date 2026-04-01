"use strict";

var GPly = {
    normalizeExtent: 1.6,

    loadMesh: async function(filePath, color) {
        var response = await fetch(filePath);
        if (!response.ok) {
            throw new Error("Failed to load PLY file: " + filePath);
        }

        var text = await response.text();
        var parsed = this.parseAsciiPly(text);
        return this.toRenderableMesh(parsed, color || [0.8, 0.8, 0.8]);
    },

    parseAsciiPly: function(data) {
        var lines = data.split(/\r?\n/);
        var vertexCount = 0;
        var faceCount = 0;
        var i = 0;

        while (i < lines.length) {
            var headerLine = lines[i].trim();
            if (headerLine.indexOf("format ascii") === 0) {
                // Supported format.
            }
            if (headerLine.indexOf("element vertex") === 0) {
                vertexCount = parseInt(headerLine.split(/\s+/)[2], 10);
            } else if (headerLine.indexOf("element face") === 0) {
                faceCount = parseInt(headerLine.split(/\s+/)[2], 10);
            } else if (headerLine === "end_header") {
                i++;
                break;
            }
            i++;
        }

        var vertices = [];
        var v;
        for (v = 0; v < vertexCount && i < lines.length; ) {
            var vertexLine = lines[i++].trim();
            if (!vertexLine) {
                continue;
            }
            var vertexParts = vertexLine.split(/\s+/);
            if (vertexParts.length < 3) {
                continue;
            }
            vertices.push([
                parseFloat(vertexParts[0]),
                parseFloat(vertexParts[1]),
                parseFloat(vertexParts[2])
            ]);
            v++;
        }

        var faces = [];
        var f;
        for (f = 0; f < faceCount && i < lines.length; ) {
            var faceLine = lines[i++].trim();
            if (!faceLine) {
                continue;
            }
            var faceParts = faceLine.split(/\s+/).map(Number);
            var n = faceParts[0];
            if (n >= 3 && faceParts.length >= n + 1) {
                faces.push(faceParts.slice(1, n + 1));
                f++;
            }
        }

        return {
            vertices: vertices,
            faces: faces
        };
    },

    toRenderableMesh: function(parsed, color) {
        var normalized = this.normalizeVertices(parsed.vertices, this.normalizeExtent);
        var tris = this.triangulateFaces(parsed.faces);

        var smoothNormalsByVertex = this.computeSmoothNormals(normalized, tris);

        var positions = [];
        var flatNormals = [];
        var smoothNormals = [];
        var colors = [];

        var i;
        for (i = 0; i < tris.length; i += 3) {
            var ia = tris[i];
            var ib = tris[i + 1];
            var ic = tris[i + 2];

            var a = normalized[ia];
            var b = normalized[ib];
            var c = normalized[ic];

            positions.push(
                a[0], a[1], a[2],
                b[0], b[1], b[2],
                c[0], c[1], c[2]
            );

            var triNormal = this.computeFaceNormal(a, b, c);
            flatNormals.push(
                triNormal[0], triNormal[1], triNormal[2],
                triNormal[0], triNormal[1], triNormal[2],
                triNormal[0], triNormal[1], triNormal[2]
            );

            var na = smoothNormalsByVertex[ia];
            var nb = smoothNormalsByVertex[ib];
            var nc = smoothNormalsByVertex[ic];
            smoothNormals.push(
                na[0], na[1], na[2],
                nb[0], nb[1], nb[2],
                nc[0], nc[1], nc[2]
            );

            colors.push(
                color[0], color[1], color[2],
                color[0], color[1], color[2],
                color[0], color[1], color[2]
            );
        }

        var wirePositions = this.buildWirePositions(normalized, parsed.faces);
        var radius = this.computeBoundingRadius(normalized);

        return {
            positions: new Float32Array(positions),
            flatNormals: new Float32Array(flatNormals),
            smoothNormals: new Float32Array(smoothNormals),
            colors: new Float32Array(colors),
            vertexCount: positions.length / 3,
            wirePositions: new Float32Array(wirePositions),
            wireVertexCount: wirePositions.length / 3,
            boundingRadius: radius
        };
    },

    normalizeVertices: function(vertices, targetExtent) {
        if (!vertices.length) {
            return [];
        }

        var minX = Infinity, minY = Infinity, minZ = Infinity;
        var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        var i;
        for (i = 0; i < vertices.length; i++) {
            var v = vertices[i];
            minX = Math.min(minX, v[0]);
            minY = Math.min(minY, v[1]);
            minZ = Math.min(minZ, v[2]);
            maxX = Math.max(maxX, v[0]);
            maxY = Math.max(maxY, v[1]);
            maxZ = Math.max(maxZ, v[2]);
        }

        var cx = (minX + maxX) * 0.5;
        var cy = (minY + maxY) * 0.5;
        var cz = (minZ + maxZ) * 0.5;

        var extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
        if (extent <= 0) {
            extent = 1;
        }

        var scale = targetExtent / extent;
        var out = new Array(vertices.length);

        for (i = 0; i < vertices.length; i++) {
            var p = vertices[i];
            out[i] = [
                (p[0] - cx) * scale,
                (p[1] - cy) * scale,
                (p[2] - cz) * scale
            ];
        }

        return out;
    },

    triangulateFaces: function(faces) {
        var indices = [];
        var i;
        for (i = 0; i < faces.length; i++) {
            var face = faces[i];
            var j;
            for (j = 1; j < face.length - 1; j++) {
                indices.push(face[0], face[j], face[j + 1]);
            }
        }
        return indices;
    },

    computeSmoothNormals: function(vertices, triangleIndices) {
        var accum = [];
        var i;

        for (i = 0; i < vertices.length; i++) {
            accum.push([0, 0, 0]);
        }

        for (i = 0; i < triangleIndices.length; i += 3) {
            var ia = triangleIndices[i];
            var ib = triangleIndices[i + 1];
            var ic = triangleIndices[i + 2];

            var a = vertices[ia];
            var b = vertices[ib];
            var c = vertices[ic];

            var n = this.computeFaceNormal(a, b, c);
            accum[ia][0] += n[0];
            accum[ia][1] += n[1];
            accum[ia][2] += n[2];
            accum[ib][0] += n[0];
            accum[ib][1] += n[1];
            accum[ib][2] += n[2];
            accum[ic][0] += n[0];
            accum[ic][1] += n[1];
            accum[ic][2] += n[2];
        }

        for (i = 0; i < accum.length; i++) {
            accum[i] = this.normalizeVec3(accum[i]);
        }

        return accum;
    },

    buildWirePositions: function(vertices, faces) {
        var edgeSet = {};
        var wire = [];

        var i;
        for (i = 0; i < faces.length; i++) {
            var face = faces[i];
            var j;
            for (j = 0; j < face.length; j++) {
                var a = face[j];
                var b = face[(j + 1) % face.length];
                var lo = Math.min(a, b);
                var hi = Math.max(a, b);
                var key = lo + "_" + hi;

                if (!edgeSet[key]) {
                    edgeSet[key] = true;
                    var pa = vertices[a];
                    var pb = vertices[b];
                    wire.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
                }
            }
        }

        return wire;
    },

    computeFaceNormal: function(a, b, c) {
        var ux = b[0] - a[0];
        var uy = b[1] - a[1];
        var uz = b[2] - a[2];

        var vx = c[0] - a[0];
        var vy = c[1] - a[1];
        var vz = c[2] - a[2];

        return this.normalizeVec3([
            uy * vz - uz * vy,
            uz * vx - ux * vz,
            ux * vy - uy * vx
        ]);
    },

    normalizeVec3: function(v) {
        var len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (len <= 1e-8) {
            return [0, 0, 1];
        }
        return [v[0] / len, v[1] / len, v[2] / len];
    },

    computeBoundingRadius: function(vertices) {
        var maxR2 = 0;
        var i;
        for (i = 0; i < vertices.length; i++) {
            var p = vertices[i];
            var r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
            if (r2 > maxR2) {
                maxR2 = r2;
            }
        }
        return Math.sqrt(maxR2);
    }
};