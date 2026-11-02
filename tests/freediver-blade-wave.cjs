const assert=require('node:assert/strict');global.window=global;require('../freediver-physics.js');
const b={x:0,v:0};let cross={},sCurve=false;
for(let i=0;i<240;i++)stepFreediverBlade(b,2,1/120);
for(let i=0;i<120;i++){
 stepFreediverBlade(b,-2,1/120);
 for(const key of ['x','mid','tip'])if(b[key]>0&&cross[key]===undefined)cross[key]=i/120;
 if(b.x>0&&b.tip<0)sCurve=true;
 const p=sampleFreediverBlade(b);assert(Number.isFinite(p.x+p.y+p.angle));
}
assert(cross.x<cross.mid&&cross.mid<cross.tip,'reversal travels root -> middle -> tip');assert(sCurve,'opposing curvatures during reversal');assert(cross.tip<.35);
for(let i=0;i<360;i++)stepFreediverBlade(b,0,1/120);
assert(Math.max(Math.abs(b.x),Math.abs(b.mid),Math.abs(b.tip))<.001,'all sections straighten when unloaded');
// Sample the curved centreline to verify it does not stretch.
const shape={x:.6,mid:-.4,tip:.7};let length=0,last={x:0,y:0};
for(let i=1;i<=300;i++){const p=sampleFreediverBlade(shape,i/300),next={x:p.x,y:p.y-.7566*i/300};length+=Math.hypot(next.x-last.x,next.y-last.y);last=next;}
assert(Math.abs(length-.7566)<.0001);console.log({cross,sCurve,length});
