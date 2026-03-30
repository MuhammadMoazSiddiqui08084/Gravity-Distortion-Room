"use strict";
// ============================================================
// GEOMETRY.JS — Procedural 3D Mesh Generation (WebGL)
// All objects generated programmatically via mathematics.
// Each generator returns: { positions, flatNormals, smoothNormals,
//   colors, vertexCount, wirePositions, wireVertexCount, boundingRadius }
// ============================================================

// ---------- CUBE ----------
function generateCube(size, color) {
    var s = size / 2;
    var corners = [
        [-s,-s,-s], [s,-s,-s], [s,s,-s], [-s,s,-s],
        [-s,-s, s], [s,-s, s], [s,s, s], [-s,s, s]
    ];
    var faces = [
        { v:[4,5,6,7], n:[0,0,1]  },
        { v:[1,0,3,2], n:[0,0,-1] },
        { v:[3,7,6,2], n:[0,1,0]  },
        { v:[0,1,5,4], n:[0,-1,0] },
        { v:[5,1,2,6], n:[1,0,0]  },
        { v:[0,4,7,3], n:[-1,0,0] }
    ];
    var pos=[], fn=[], sn=[], col=[], wp=[];
    for (var f=0; f<faces.length; f++) {
        var fc=faces[f], idx=fc.v, nm=fc.n;
        var v0=corners[idx[0]], v1=corners[idx[1]], v2=corners[idx[2]], v3=corners[idx[3]];
        var tri=[v0,v1,v2, v0,v2,v3];
        for (var t=0; t<6; t++) {
            var p=tri[t];
            pos.push(p[0],p[1],p[2]);
            fn.push(nm[0],nm[1],nm[2]);
            var len=Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]);
            if(len>0) sn.push(p[0]/len,p[1]/len,p[2]/len);
            else sn.push(0,0,1);
            col.push(color[0],color[1],color[2]);
        }
    }
    var edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    for(var e=0;e<edges.length;e++){
        var a=corners[edges[e][0]], b=corners[edges[e][1]];
        wp.push(a[0],a[1],a[2], b[0],b[1],b[2]);
    }
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(fn),
        smoothNormals:new Float32Array(sn), colors:new Float32Array(col),
        vertexCount:36, wirePositions:new Float32Array(wp), wireVertexCount:24,
        boundingRadius: size*Math.sqrt(3)/2
    };
}

// ---------- ICOSPHERE ----------
function _icoMidpoint(a, b, verts, cache) {
    var key = Math.min(a,b)+"_"+Math.max(a,b);
    if (cache[key]!==undefined) return cache[key];
    var va=verts[a], vb=verts[b];
    var mid=[(va[0]+vb[0])/2,(va[1]+vb[1])/2,(va[2]+vb[2])/2];
    var len=Math.sqrt(mid[0]*mid[0]+mid[1]*mid[1]+mid[2]*mid[2]);
    mid=[mid[0]/len,mid[1]/len,mid[2]/len];
    var idx=verts.length;
    verts.push(mid);
    cache[key]=idx;
    return idx;
}

function generateIcosphere(radius, subdivisions, color) {
    var phi=(1+Math.sqrt(5))/2;
    var verts=[
        [-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],
        [0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],
        [phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]
    ];
    for(var i=0;i<verts.length;i++){
        var v=verts[i], len=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
        verts[i]=[v[0]/len,v[1]/len,v[2]/len];
    }
    var faces=[
        [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
        [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
        [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
        [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
    ];
    for(var s=0;s<subdivisions;s++){
        var nf=[], cache={};
        for(var f=0;f<faces.length;f++){
            var a=faces[f][0],b=faces[f][1],c=faces[f][2];
            var ab=_icoMidpoint(a,b,verts,cache);
            var bc=_icoMidpoint(b,c,verts,cache);
            var ca=_icoMidpoint(c,a,verts,cache);
            nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
        }
        faces=nf;
    }
    var pos=[],fn=[],sn=[],col=[],wp=[];
    var wireSet={};
    for(var f=0;f<faces.length;f++){
        var ia=faces[f][0],ib=faces[f][1],ic=faces[f][2];
        var a=verts[ia],b=verts[ib],c=verts[ic];
        var ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
        var vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
        var nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
        var nl=Math.sqrt(nx*nx+ny*ny+nz*nz);
        if(nl>0){nx/=nl;ny/=nl;nz/=nl;}
        var tv=[a,b,c];
        for(var t=0;t<3;t++){
            var v=tv[t];
            pos.push(v[0]*radius,v[1]*radius,v[2]*radius);
            fn.push(nx,ny,nz);
            sn.push(v[0],v[1],v[2]);
            col.push(color[0],color[1],color[2]);
        }
        var ei=[ia,ib,ic];
        for(var e=0;e<3;e++){
            var ea=ei[e],eb=ei[(e+1)%3];
            var key=Math.min(ea,eb)+"_"+Math.max(ea,eb);
            if(!wireSet[key]){
                wireSet[key]=true;
                var va=verts[ea],vb=verts[eb];
                wp.push(va[0]*radius,va[1]*radius,va[2]*radius,
                        vb[0]*radius,vb[1]*radius,vb[2]*radius);
            }
        }
    }
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(fn),
        smoothNormals:new Float32Array(sn), colors:new Float32Array(col),
        vertexCount:faces.length*3, wirePositions:new Float32Array(wp),
        wireVertexCount:wp.length/3, boundingRadius:radius
    };
}

// ---------- TORUS ----------
function generateTorus(majorR, minorR, majSegs, minSegs, color) {
    var grid=[];
    for(var i=0;i<=majSegs;i++){
        grid[i]=[];
        var u=(i/majSegs)*2*Math.PI;
        for(var j=0;j<=minSegs;j++){
            var v=(j/minSegs)*2*Math.PI;
            var x=(majorR+minorR*Math.cos(v))*Math.cos(u);
            var y=minorR*Math.sin(v);
            var z=(majorR+minorR*Math.cos(v))*Math.sin(u);
            var cx=majorR*Math.cos(u), cz=majorR*Math.sin(u);
            var nx=x-cx, ny=y, nz=z-cz;
            var nl=Math.sqrt(nx*nx+ny*ny+nz*nz);
            if(nl>0){nx/=nl;ny/=nl;nz/=nl;}
            grid[i][j]={pos:[x,y,z],normal:[nx,ny,nz]};
        }
    }
    var pos=[],fn=[],sn=[],col=[],wp=[];
    for(var i=0;i<majSegs;i++){
        for(var j=0;j<minSegs;j++){
            var a=grid[i][j],b=grid[i+1][j],c=grid[i+1][j+1],d=grid[i][j+1];
            // Face normal for tri 1 (a,b,c)
            var u1x=b.pos[0]-a.pos[0],u1y=b.pos[1]-a.pos[1],u1z=b.pos[2]-a.pos[2];
            var v1x=c.pos[0]-a.pos[0],v1y=c.pos[1]-a.pos[1],v1z=c.pos[2]-a.pos[2];
            var n1x=u1y*v1z-u1z*v1y, n1y=u1z*v1x-u1x*v1z, n1z=u1x*v1y-u1y*v1x;
            var n1l=Math.sqrt(n1x*n1x+n1y*n1y+n1z*n1z);
            if(n1l>0){n1x/=n1l;n1y/=n1l;n1z/=n1l;}
            // Face normal for tri 2 (a,c,d)
            var u2x=c.pos[0]-a.pos[0],u2y=c.pos[1]-a.pos[1],u2z=c.pos[2]-a.pos[2];
            var v2x=d.pos[0]-a.pos[0],v2y=d.pos[1]-a.pos[1],v2z=d.pos[2]-a.pos[2];
            var n2x=u2y*v2z-u2z*v2y, n2y=u2z*v2x-u2x*v2z, n2z=u2x*v2y-u2y*v2x;
            var n2l=Math.sqrt(n2x*n2x+n2y*n2y+n2z*n2z);
            if(n2l>0){n2x/=n2l;n2y/=n2l;n2z/=n2l;}
            // Triangle 1
            var t1=[a,b,c];
            for(var t=0;t<3;t++){
                pos.push(t1[t].pos[0],t1[t].pos[1],t1[t].pos[2]);
                fn.push(n1x,n1y,n1z);
                sn.push(t1[t].normal[0],t1[t].normal[1],t1[t].normal[2]);
                col.push(color[0],color[1],color[2]);
            }
            // Triangle 2
            var t2=[a,c,d];
            for(var t=0;t<3;t++){
                pos.push(t2[t].pos[0],t2[t].pos[1],t2[t].pos[2]);
                fn.push(n2x,n2y,n2z);
                sn.push(t2[t].normal[0],t2[t].normal[1],t2[t].normal[2]);
                col.push(color[0],color[1],color[2]);
            }
            wp.push(a.pos[0],a.pos[1],a.pos[2], b.pos[0],b.pos[1],b.pos[2]);
            wp.push(a.pos[0],a.pos[1],a.pos[2], d.pos[0],d.pos[1],d.pos[2]);
        }
    }
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(fn),
        smoothNormals:new Float32Array(sn), colors:new Float32Array(col),
        vertexCount:majSegs*minSegs*6, wirePositions:new Float32Array(wp),
        wireVertexCount:wp.length/3, boundingRadius:majorR+minorR
    };
}

// ---------- ROOM QUAD ----------
// Generates a single quad (2 triangles) for a wall/floor/ceiling.
// The quad lies in the XY plane at z=0, then you transform it with a model matrix.
function generateQuad(width, height, color) {
    var hw=width/2, hh=height/2;
    var pos = [
        -hw,-hh,0, hw,-hh,0, hw,hh,0,
        -hw,-hh,0, hw,hh,0, -hw,hh,0
    ];
    var nm = [0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1];
    var col = [];
    for(var i=0;i<6;i++) col.push(color[0],color[1],color[2]);
    var wp = [
        -hw,-hh,0, hw,-hh,0,
        hw,-hh,0, hw,hh,0,
        hw,hh,0, -hw,hh,0,
        -hw,hh,0, -hw,-hh,0
    ];
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(nm),
        smoothNormals:new Float32Array(nm), colors:new Float32Array(col),
        vertexCount:6, wirePositions:new Float32Array(wp), wireVertexCount:8,
        boundingRadius: Math.sqrt(hw*hw+hh*hh)
    };
}

// ---------- GRID FLOOR ----------
// Generates a floor with visible grid lines via alternating colors.
function generateGridFloor(width, depth, divisions, color1, color2) {
    var pos=[],fn=[],col=[],wp=[];
    var cellW=width/divisions, cellD=depth/divisions;
    var startX=-width/2, startZ=-depth/2;
    for(var i=0;i<divisions;i++){
        for(var j=0;j<divisions;j++){
            var x0=startX+i*cellW, x1=x0+cellW;
            var z0=startZ+j*cellD, z1=z0+cellD;
            var c=((i+j)%2===0)?color1:color2;
            // Two triangles for this cell (in XZ plane, y=0)
            pos.push(x0,0,z0, x1,0,z0, x1,0,z1,  x0,0,z0, x1,0,z1, x0,0,z1);
            for(var k=0;k<6;k++){ fn.push(0,1,0); col.push(c[0],c[1],c[2]); }
            wp.push(x0,0,z0, x1,0,z0,  x1,0,z0, x1,0,z1,
                    x1,0,z1, x0,0,z1,  x0,0,z1, x0,0,z0);
        }
    }
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(fn),
        smoothNormals:new Float32Array(fn), colors:new Float32Array(col),
        vertexCount:divisions*divisions*6, wirePositions:new Float32Array(wp),
        wireVertexCount:wp.length/3, boundingRadius:Math.sqrt(width*width+depth*depth)/2
    };
}

// ---------- ROOM QUADS (axis-aligned, no transforms needed) ----------

// XZ plane quad (for ceiling/floor). normalDown=true → normal faces -Y, false → +Y is default floor
function generateRoomQuadXZ(width, depth, color, normalDown) {
    var hw=width/2, hd=depth/2;
    var ny = normalDown ? -1 : 1;
    var pos, nm;
    if (normalDown) {
        // CCW from below: wind for -Y normal
        pos = [ -hw,0,-hd,  -hw,0,hd,  hw,0,hd,   -hw,0,-hd,  hw,0,hd,  hw,0,-hd ];
    } else {
        pos = [ -hw,0,-hd,  hw,0,-hd,  hw,0,hd,   -hw,0,-hd,  hw,0,hd,  -hw,0,hd ];
    }
    nm = [0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0, 0,ny,0];
    var col=[];
    for(var i=0;i<6;i++) col.push(color[0],color[1],color[2]);
    var wp = [ -hw,0,-hd, hw,0,-hd,  hw,0,-hd, hw,0,hd,  hw,0,hd, -hw,0,hd,  -hw,0,hd, -hw,0,-hd ];
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(nm),
        smoothNormals:new Float32Array(nm), colors:new Float32Array(col),
        vertexCount:6, wirePositions:new Float32Array(wp), wireVertexCount:8,
        boundingRadius:Math.sqrt(hw*hw+hd*hd)
    };
}

// XY plane quad (for front/back walls). facingPosZ=true → normal faces +Z, false → -Z
function generateRoomQuadXY(width, height, color, facingPosZ) {
    var hw=width/2, hh=height/2;
    var nz = facingPosZ ? 1 : -1;
    var pos;
    if (facingPosZ) {
        pos = [ -hw,-hh,0, hw,-hh,0, hw,hh,0,  -hw,-hh,0, hw,hh,0, -hw,hh,0 ];
    } else {
        pos = [ hw,-hh,0, -hw,-hh,0, -hw,hh,0,  hw,-hh,0, -hw,hh,0, hw,hh,0 ];
    }
    var nm = [0,0,nz, 0,0,nz, 0,0,nz, 0,0,nz, 0,0,nz, 0,0,nz];
    var col=[];
    for(var i=0;i<6;i++) col.push(color[0],color[1],color[2]);
    var wp = [ -hw,-hh,0, hw,-hh,0, hw,-hh,0, hw,hh,0, hw,hh,0, -hw,hh,0, -hw,hh,0, -hw,-hh,0 ];
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(nm),
        smoothNormals:new Float32Array(nm), colors:new Float32Array(col),
        vertexCount:6, wirePositions:new Float32Array(wp), wireVertexCount:8,
        boundingRadius:Math.sqrt(hw*hw+hh*hh)
    };
}

// ZY plane quad (for left/right walls). facingPosX=true → normal faces +X, false → -X
function generateRoomQuadZY(depth, height, color, facingPosX) {
    var hd=depth/2, hh=height/2;
    var nx = facingPosX ? 1 : -1;
    var pos;
    if (facingPosX) {
        pos = [ 0,-hh,-hd, 0,-hh,hd, 0,hh,hd,  0,-hh,-hd, 0,hh,hd, 0,hh,-hd ];
    } else {
        pos = [ 0,-hh,hd, 0,-hh,-hd, 0,hh,-hd,  0,-hh,hd, 0,hh,-hd, 0,hh,hd ];
    }
    var nm = [nx,0,0, nx,0,0, nx,0,0, nx,0,0, nx,0,0, nx,0,0];
    var col=[];
    for(var i=0;i<6;i++) col.push(color[0],color[1],color[2]);
    var wp = [ 0,-hh,-hd, 0,-hh,hd, 0,-hh,hd, 0,hh,hd, 0,hh,hd, 0,hh,-hd, 0,hh,-hd, 0,-hh,-hd ];
    return {
        positions:new Float32Array(pos), flatNormals:new Float32Array(nm),
        smoothNormals:new Float32Array(nm), colors:new Float32Array(col),
        vertexCount:6, wirePositions:new Float32Array(wp), wireVertexCount:8,
        boundingRadius:Math.sqrt(hd*hd+hh*hh)
    };
}
