const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),T=require('../three.min.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../ocean.js'),'utf8');
const start=source.indexOf('  function buildSmallFishGeometry()'),end=source.indexOf('  const fishGeometry',start),scope={T};
vm.runInNewContext(source.slice(start,end)+'\nthis.geometry=buildSmallFishGeometry();',scope);
const p=scope.geometry.attributes.position,n=scope.geometry.attributes.normal;
for(let i=0;i<19*13;i++)assert(p.getY(i)*n.getY(i)+p.getZ(i)*n.getZ(i)>0,'fish trunk normal must face outwards: '+i);
console.log('All 247 schoolfish trunk normals face outwards PASS');
