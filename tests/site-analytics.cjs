const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../site-analytics.js'),'utf8');
function run(url){const location=new URL(url),sent=[],window={};vm.runInNewContext(source,{location,window,document:{createElement:()=>({dataset:{}}),head:{appendChild:s=>sent.push(s)}}});return{sent,window};}
for(const url of ['file:///D:/Dropbox/index.html','http://localhost:8000/ocean-freediver-screensaver/','https://krauhe.github.io/T1D-Simulator/','https://example.com/ocean-freediver-screensaver/'])assert.equal(run(url).sent.length,0);
for(const url of ['https://krauhe.github.io/ocean-freediver-screensaver/','https://krauhe.github.io/ocean-freediver-screensaver/index.html?build=test']){
 const r=run(url);assert.equal(r.sent.length,1);assert.equal(r.sent[0].dataset.goatcounter,'https://ocean-freediver-screensaver.goatcounter.com/count');assert.equal(r.window.goatcounter.path,'/ocean-freediver-screensaver/');assert.equal(r.sent[0].async,true);
}
console.log('Analytics: dedicated endpoint, production-only loading and canonical path PASS');
