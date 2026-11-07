const assert=require('node:assert/strict'),T=require('../three.min.js');global.window=global;require('../rope-physics.js');
function simulate(hz){
 const rope=createDiveRope(T,0,0);let firstTop,firstMiddle;
 for(let i=0;i<12*hz;i++){
  const x=Math.min(8,i/hz*2);rope.update(1/hz,x,0,15);
  if(i===Math.round(.5*hz)){firstTop=rope.nodes.at(-1).x;firstMiddle=rope.nodes[12].x;}
 }
 const maxSegment=Math.max(...rope.nodes.slice(1).map((p,i)=>p.distanceTo(rope.nodes[i])));
 assert(maxSegment<rope.segment*1.1,'rope cannot stretch indefinitely');
 assert(Math.abs(firstTop)<.5&&Math.abs(firstMiddle-.8)<.5,'ballast motion reaches buoy and middle gradually');
 assert(rope.nodes.at(-1).x>2,'buoy eventually follows the ballast');
 const before=rope.nodes.map(p=>p.clone());rope.update(0,8,0,15);assert(rope.nodes.every((p,i)=>p.equals(before[i])),'pause freezes line');
 return {tip:rope.nodes.at(-1).x,middle:rope.nodes[12].x,maxSegment};
}
const a=simulate(30),b=simulate(60);assert(Math.abs(a.tip-b.tip)<.25);console.log('Rope: bounded length, delayed following, pause and frame rates PASS',a,b);
