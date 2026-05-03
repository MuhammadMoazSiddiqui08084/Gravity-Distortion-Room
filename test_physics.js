// Quick smoke test for the physics system.
const fs = require('fs');
var code = fs.readFileSync('physics.js', 'utf8');
code = code.replace('"use strict";', '');
eval(code);

// Start with one body, switch gravity to the left, and print positions over time.
GPhysics.bodies = [GPhysics.createBody({boundingRadius: 1.0}, [0, 5, 0], 1.0, 0)];
GPhysics.setGravity([-1, 0, 0], 10);

for(let i = 0; i < 60; i++) {
    GPhysics.update(0.016);
    console.log(GPhysics.bodies[0].position[0]);
}
