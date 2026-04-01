"use strict";
//WebGL Rendering with 3 Shading Modes
//Wireframe (edges only), Flat (per-face normals), Smooth (Phong)

var GRenderer = {
    gl: null,
    program: null,
    //Uniform locations
    loc: {},
    //Shading mode: 1=wireframe, 2=flat, 3=smooth
    shadingMode: 3,
    //Lighting
    lightDir: [0.3, 0.8, 0.5],
    lightColor: [1.0, 0.95, 0.9],
    ambientColor: [0.25, 0.22, 0.3],
    specStrength: 0.5,
    shininess: 32.0,
    wireColor: [0.0, 1.0, 0.6],

    init: function(gl, program) {
        this.gl = gl;
        this.program = program;
        //Cache uniform locations
        this.loc.modelMatrix = gl.getUniformLocation(program, "uModelMatrix");
        this.loc.viewMatrix = gl.getUniformLocation(program, "uViewMatrix");
        this.loc.projMatrix = gl.getUniformLocation(program, "uProjectionMatrix");
        this.loc.normalMatrix = gl.getUniformLocation(program, "uNormalMatrix");
        this.loc.lightDir = gl.getUniformLocation(program, "uLightDirection");
        this.loc.lightColor = gl.getUniformLocation(program, "uLightColor");
        this.loc.ambientColor = gl.getUniformLocation(program, "uAmbientColor");
        this.loc.cameraPos = gl.getUniformLocation(program, "uCameraPosition");
        this.loc.specStrength = gl.getUniformLocation(program, "uSpecularStrength");
        this.loc.shininess = gl.getUniformLocation(program, "uShininess");
        this.loc.renderMode = gl.getUniformLocation(program, "uRenderMode");
        this.loc.solidColor = gl.getUniformLocation(program, "uSolidColor");
        this.loc.aPosition = gl.getAttribLocation(program, "aPosition");
        this.loc.aNormal = gl.getAttribLocation(program, "aNormal");
        this.loc.aColor = gl.getAttribLocation(program, "aColor");
    },

    //WebGL buffers for mesh
    createBuffers: function(mesh) {
        var gl = this.gl;
        var buf = {};
        // Positions
        buf.position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.position);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
        // Flat normals
        buf.flatNormal = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.flatNormal);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.flatNormals, gl.STATIC_DRAW);
        // Smooth normals
        buf.smoothNormal = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.smoothNormal);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.smoothNormals, gl.STATIC_DRAW);
        // Colors
        buf.color = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.color);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);
        // Wireframe positions
        buf.wire = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.wire);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.wirePositions, gl.STATIC_DRAW);
        buf.vertexCount = mesh.vertexCount;
        buf.wireVertexCount = mesh.wireVertexCount;
        return buf;
    },

    //camera uniforms
    setCamera: function(viewMatrix, projMatrix, cameraPos) {
        var gl = this.gl;
        gl.uniformMatrix4fv(this.loc.viewMatrix, false, flatten(viewMatrix));
        gl.uniformMatrix4fv(this.loc.projMatrix, false, flatten(projMatrix));
        gl.uniform3fv(this.loc.cameraPos, new Float32Array(cameraPos));
    },

    //lighting uniforms
    setLighting: function() {
        var gl = this.gl;
        gl.uniform3fv(this.loc.lightDir, new Float32Array(this.lightDir));
        gl.uniform3fv(this.loc.lightColor, new Float32Array(this.lightColor));
        gl.uniform3fv(this.loc.ambientColor, new Float32Array(this.ambientColor));
        gl.uniform1f(this.loc.specStrength, this.specStrength);
        gl.uniform1f(this.loc.shininess, this.shininess);
    },

    //3x3 normal matrix from 4x4 model matrix
    computeNormalMatrix: function(m) {
        // Extract 3x3
        var a00=m[0][0],a01=m[1][0],a02=m[2][0];
        var a10=m[0][1],a11=m[1][1],a12=m[2][1];
        var a20=m[0][2],a21=m[1][2],a22=m[2][2];
        // Determinant
        var det = a00*(a11*a22-a12*a21) - a01*(a10*a22-a12*a20) + a02*(a10*a21-a11*a20);
        if (Math.abs(det) < 1e-6) det = 1;
        var id = 1.0/det;
        //Inverse transpose
        return new Float32Array([
            (a11*a22-a12*a21)*id, (a12*a20-a10*a22)*id, (a10*a21-a11*a20)*id,
            (a02*a21-a01*a22)*id, (a00*a22-a02*a20)*id, (a01*a20-a00*a21)*id,
            (a01*a12-a02*a11)*id, (a02*a10-a00*a12)*id, (a00*a11-a01*a10)*id
        ]);
    },

    //single object with its model matrix
    drawObject: function(buffers, modelMatrix) {
        var gl = this.gl;
        var loc = this.loc;

        //Set model matrix
        gl.uniformMatrix4fv(loc.modelMatrix, false, flatten(modelMatrix));

        //Set normal matrix
        var nmat = this.computeNormalMatrix(modelMatrix);
        gl.uniformMatrix3fv(loc.normalMatrix, false, nmat);

        if (this.shadingMode === 1) {
            //wireframe mode
            gl.uniform1i(loc.renderMode, 0);
            gl.uniform3fv(loc.solidColor, new Float32Array(this.wireColor));
            // Bind wireframe positions
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.wire);
            gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(loc.aPosition);
            gl.disableVertexAttribArray(loc.aNormal);
            gl.disableVertexAttribArray(loc.aColor);
            gl.vertexAttrib3f(loc.aNormal, 0, 1, 0);
            gl.vertexAttrib3f(loc.aColor, 1, 1, 1);
            gl.drawArrays(gl.LINES, 0, buffers.wireVertexCount);
        } else {
            //Flat or Smooth shading
            var renderMode = (this.shadingMode === 2) ? 1 : 2;
            gl.uniform1i(loc.renderMode, renderMode);
            // Positions
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(loc.aPosition);
            // Normals (flat vs smooth)
            var normalBuf = (this.shadingMode === 2) ? buffers.flatNormal : buffers.smoothNormal;
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuf);
            gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(loc.aNormal);
            // Colors
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
            gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(loc.aColor);
            gl.drawArrays(gl.TRIANGLES, 0, buffers.vertexCount);
        }
    }
};
