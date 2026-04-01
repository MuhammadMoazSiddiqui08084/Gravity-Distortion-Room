// Remove strict mode for eval context
var code = require('fs').readFileSync('geometry.js', 'utf8');
code = code.replace('"use strict";', '');
eval(code);

var m;
m = generateCube(1.2, [0,0,0]);
console.log('cube 1.2 boundingRadius:', m.boundingRadius);

m = generateCube(0.8, [0,0,0]);
console.log('cube 0.8 boundingRadius:', m.boundingRadius);

m = generateCube(1.0, [0,0,0]);
console.log('cube 1.0 boundingRadius:', m.boundingRadius);

m = generateIcosphere(0.7, 2, [0,0,0]);
console.log('icosphere 0.7 boundingRadius:', m.boundingRadius);

m = generateIcosphere(0.5, 2, [0,0,0]);
console.log('icosphere 0.5 boundingRadius:', m.boundingRadius);

m = generateIcosphere(0.6, 2, [0,0,0]);
console.log('icosphere 0.6 boundingRadius:', m.boundingRadius);

m = generateTorus(0.6, 0.2, 24, 12, [0,0,0]);
console.log('torus 0.6/0.2 boundingRadius:', m.boundingRadius);

m = generateTorus(0.5, 0.15, 20, 10, [0,0,0]);
console.log('torus 0.5/0.15 boundingRadius:', m.boundingRadius);

m = generateEscherStaircase(16, 0.25, 0.28, 0.7, [0,0,0]);
console.log('staircase 16 boundingRadius:', m.boundingRadius);

m = generateEscherStaircase(24, 0.35, 0.38, 1.1, [0,0,0]);
console.log('staircase 24 boundingRadius:', m.boundingRadius);

// Check what physics would assign as radius for each
// physics.js: radius = (mesh.boundingRadius || 1.0) * (scale || 1.0)
// Room bounds: X in [-8, 8], Y in [0, 10], Z in [-8, 8]
console.log('\\nRoom dimensions: X=[-8,8] Y=[0,10] Z=[-8,8]');
console.log('Room halfW=8, halfD=8, height=10');
