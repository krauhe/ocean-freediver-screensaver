const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(fs.existsSync(path.join(root,'.nojekyll')),'Publish the static site without Jekyll converting research notes');
const versions=[];
for(const match of html.matchAll(/\b(?:src|href)="([^"?:]+\.(?:js|css))\?v=([a-f0-9]+)"/g)){
 const bytes=fs.readFileSync(path.join(root,match[1]));
 const hash=crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12);
 assert.equal(match[2],hash,'Run node scripts/prepare-release.cjs after editing '+match[1]);
 versions.push(match[1]+':'+hash);
}
assert(versions.length>20,'All app scripts must be versioned');
const build=crypto.createHash('sha256').update(versions.join('\n')).digest('hex').slice(0,12);
assert(html.includes('id="build-version">'+build));
const decoder=new TextDecoder('utf-8',{fatal:true});
for(const dir of [root,path.join(root,'docs')])for(const name of fs.readdirSync(dir)){
 if(/\.(md|js|html|css)$/.test(name))assert.doesNotThrow(()=>decoder.decode(fs.readFileSync(path.join(dir,name))),name+' must be valid UTF-8');
}
console.log('Static release: asset hashes, build identity and UTF-8 PASS');
