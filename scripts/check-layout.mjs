import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base=new URL('../dist/',import.meta.url);
const lib=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('layout.js',base),'utf8')).toString('base64'));
const ctx={...lib};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('app.js',base),'utf8').replace(/^import[^\n]+\n/,'').replace(/init\(\);\s*$/,''),ctx);
vm.runInContext('data='+fs.readFileSync(new URL('data.json',base),'utf8'),ctx);
const results=vm.runInContext(`['all',...data.applications].flatMap(g=>{const ps=groupPapers(g),es=groupEdges(g),base=treeLayout(ps,es);return ['tree','radial'].map(mode=>{const l=optimizedLayout(base,es,mode);if(mode==='radial'){const outer=[...l.points.values()].filter(p=>p.p.baselineOnly),inner=[...l.points.values()].filter(p=>!p.p.baselineOnly);if(outer.length&&inner.length&&Math.min(...outer.map(p=>p.radius))<=Math.max(...inner.map(p=>p.radius)))throw Error('Baseline ring must be outermost: '+g);}return {group:g,mode,nodes:l.points.size,expected:ps.length,...l.metrics};});})`,ctx);
for(const r of results){assert.equal(r.nodes,r.expected);assert.equal(r.overlaps,false,r.group+' '+r.mode);assert.ok(Number.isFinite(r.total));assert.ok(r.total<=r.before+.01);}
// Empty graphs, isolates, and cyclic evidence must remain valid and finite.
for(const edges of [[],[{source:'a',target:'b'},{source:'b',target:'a'}]]){
 const papers=['a','b','c'].map(id=>({id,label:id,year:2024,citations:0}));ctx.testPapers=papers;ctx.testEdges=edges;
 for(const mode of ['tree','radial']){ctx.mode=mode;const l=vm.runInContext('optimizedLayout(treeLayout(testPapers,testEdges),testEdges,mode)',ctx);assert.equal(l.points.size,3);assert.equal(l.metrics.overlaps,false);assert.ok(Number.isFinite(l.metrics.total));}
}
console.log(JSON.stringify(results.map(({group,mode,total,saved,crossings})=>({group,mode,total:Math.round(total),saved:Number(saved.toFixed(1)),crossings})),null,2));
console.log('PASS: 26 global/application layouts, empty/isolated/cyclic graphs; all nodes retained, no label-box overlap, no length regression.');
