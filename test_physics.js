const fs = require('fs');
eval(fs.readFileSync('physics.js', 'utf8'));

GPhysics.bodies = [GPhysics.createBody({boundingRadius: 1.0}, [0, 5, 0], 1.0, 0)];
GPhysics.setGravity([-1, 0, 0], 10);

for(let i = 0; i < 60; i++) {
    GPhysics.update(0.016);
    console.log(GPhysics.bodies[0].position[0]);
}
