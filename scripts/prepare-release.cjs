// Version local scripts/styles by content; works on GitHub Pages and file://.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=s=>crypto.createHash('sha256').update(s.toString().replace(/\r\n/g,'\n')).digest('hex').slice(0,12);
const file=path.join(root,'index.html');let html=fs.readFileSync(file,'utf8');
const versions=[];
html=html.replace(/(\b(?:src|href)=")([^"?:]+\.(?:js|css))(?:\?v=[^" ]*)?(")/g,(_,start,name,end)=>{
 const version=hash(fs.readFileSync(path.join(root,name)));versions.push(name+':'+version);
 return start+name+'?v='+version+end;
});
const build=hash(versions.join('\n'));
html=html.replace(/(id="build-version">)[^<]*/, '$1'+build);
fs.writeFileSync(file,html);console.log('Prepared build '+build);
