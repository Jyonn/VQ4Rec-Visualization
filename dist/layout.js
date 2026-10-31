// Deterministic, constrained local search. Both rendering and scoring use these curves.
export function curve(a,b,mode){
  if(mode==='radial'){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;const start={x:a.x+dx/d*9,y:a.y+dy/d*9},end={x:b.x-dx/d*10,y:b.y-dy/d*10};return [start,{x:start.x+dx*.34-dy*.04,y:start.y+dy*.34+dx*.04},{x:end.x-dx*.34-dy*.04,y:end.y-dy*.34+dx*.04},end];}
  if(a.rank===b.rank)return [{x:a.x,y:a.y},{x:a.x-45,y:a.y},{x:b.x-45,y:b.y},{x:b.x-9,y:b.y}];
  const x=(a.x+b.x)/2;return [{x:a.x+9,y:a.y},{x,y:a.y},{x,y:b.y},{x:b.x-10,y:b.y}];
}
export const curvePath=c=>`M${c[0].x},${c[0].y} C${c[1].x},${c[1].y} ${c[2].x},${c[2].y} ${c[3].x},${c[3].y}`;
export function samples(c,n=18){return Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return {x:u*u*u*c[0].x+3*u*u*t*c[1].x+3*u*t*t*c[2].x+t*t*t*c[3].x,y:u*u*u*c[0].y+3*u*u*t*c[1].y+3*u*t*t*c[2].y+t*t*t*c[3].y};});}
function length(c){const p=samples(c);return p.slice(1).reduce((n,b,i)=>n+Math.hypot(b.x-p[i].x,b.y-p[i].y),0);}
function collide(a,b){return Math.abs(a.x-b.x)<218&&Math.abs(a.y-b.y)<32;}
function valid(points){const ps=[...points.values()];for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)if(collide(ps[i],ps[j]))return false;return true;}
function total(points,edges,mode){return edges.reduce((n,e)=>n+length(curve(points.get(e.source),points.get(e.target),mode)),0);}
function clone(points){return new Map([...points].map(([id,p])=>[id,{...p}]));}
function crossings(points,edges,mode){const paths=edges.map(e=>samples(curve(points.get(e.source),points.get(e.target),mode),12));const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);let count=0;for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){if([edges[i].source,edges[i].target].some(id=>id===edges[j].source||id===edges[j].target))continue;let hit=false;for(let a=1;a<paths[i].length&&!hit;a++)for(let b=1;b<paths[j].length;b++){const p=paths[i][a-1],q=paths[i][a],r=paths[j][b-1],s=paths[j][b];if(orient(p,q,r)*orient(p,q,s)<0&&orient(r,s,p)*orient(r,s,q)<0){hit=true;break;}}if(hit)count++;}return count;}
const cache=new Map();
export function optimizedLayout(base,edges,mode='tree'){
  const key=mode+'|'+[...base.points].map(([id,p])=>id+':'+p.rank).join(',')+'|'+edges.map(e=>e.source+'>'+e.target).join(',');if(cache.has(key))return cache.get(key);
  const incident=new Map([...base.points.keys()].map(id=>[id,[]]));edges.forEach(e=>{incident.get(e.source).push(e);incident.get(e.target).push(e);});
  const layers=mode==='radial'?[ [...base.points.values()].filter(n=>n.p.baselineOnly).map(n=>n.p), ...base.layers.map(l=>l.filter(p=>!p.baselineOnly)) ].filter(l=>l.length):base.layers.map(l=>l.filter(p=>incident.get(p.id).length));const isolated=mode==='radial'?[]:[...base.points.values()].filter(n=>!incident.get(n.p.id).length);
  let best,bestLength=Infinity,before=0;
  for(let seed=0;seed<3;seed++){
    let points=clone(base.points);const orders=layers.map(l=>seed===0?[...l]:[...l].sort((a,b)=>{const hash=s=>[...s].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,seed*7891);return hash(a.id)-hash(b.id);}));
    if(mode==='tree'){orders.forEach((l,r)=>l.forEach((p,i)=>Object.assign(points.get(p.id),{x:70+r*250,y:100+i*38})));}
    else{let previousRadius=0;const placed=new Map();[...orders].reverse().forEach((l,r)=>{if(!l.length)return;let radius=Math.max(160,l.length*18,previousRadius+250);for(let attempt=0;attempt<100;attempt++){l.forEach((p,i)=>{const angle=-Math.PI/2+i*Math.PI*2/l.length;Object.assign(points.get(p.id),{x:radius*Math.cos(angle),y:radius*Math.sin(angle),radius,angle});});const candidate=new Map([...placed,...l.map(p=>[p.id,points.get(p.id)])]);if(valid(candidate))break;radius*=1.1;}l.forEach(p=>placed.set(p.id,points.get(p.id)));previousRadius=radius;});}
    const connected=[...points.values()].filter(p=>incident.get(p.p.id).length);const bottom=Math.max(100,...connected.map(p=>p.y))+90;isolated.forEach((p,i)=>Object.assign(points.get(p.p.id),{x:70+(i%4)*250,y:bottom+Math.floor(i/4)*38}));
    const initial=total(points,edges,mode);if(seed===0)before=initial;
    // Swaps preserve occupied slots and therefore preserve minimum label separation.
    for(let pass=0;pass<5;pass++){let changed=false;for(const l of orders){for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++){const a=points.get(l[i].id),b=points.get(l[j].id);const local=[...new Set([...incident.get(l[i].id),...incident.get(l[j].id)])];const old=total(points,local,mode);const posA={x:a.x,y:a.y,angle:a.angle},posB={x:b.x,y:b.y,angle:b.angle};Object.assign(a,posB);Object.assign(b,posA);const next=total(points,local,mode);if(next<old-.01){changed=true;}else{Object.assign(a,posA);Object.assign(b,posB);}}}if(!changed)break;}
    // Rotate entire rings where clearance allows; only incident curves need rescoring.
    if(mode==='radial')for(let pass=0;pass<2;pass++)for(const l of orders){if(!l.length)continue;const local=[...new Set(l.flatMap(p=>incident.get(p.id)))];for(const delta of [-.16,-.08,.08,.16]){const old=total(points,local,mode),saved=l.map(p=>({...points.get(p.id)}));for(const p of l){const n=points.get(p.id);n.angle+=delta;n.x=n.radius*Math.cos(n.angle);n.y=n.radius*Math.sin(n.angle);}if(!valid(points)||total(points,local,mode)>=old-.01)saved.forEach(n=>Object.assign(points.get(n.p.id),n));}}
    // Compact each tree column vertically toward its neighbors without label overlap.
    if(mode==='tree')for(let pass=0;pass<4;pass++)for(const l of orders){const sorted=l.map(p=>points.get(p.id)).sort((a,b)=>a.y-b.y);for(let i=0;i<sorted.length;i++){const p=sorted[i],es=incident.get(p.p.id);const ys=es.map(e=>points.get(e.source===p.p.id?e.target:e.source).y).sort((a,b)=>a-b);if(!ys.length)continue;const target=ys[Math.floor(ys.length/2)],old=p.y,oldLength=total(points,es,mode);p.y=Math.max(i?sorted[i-1].y+38:100,Math.min(i+1<sorted.length?sorted[i+1].y-38:Infinity,target));if(total(points,es,mode)>oldLength+.001)p.y=old;}}
    const score=total(points,edges,mode);if(score<bestLength){best=points;bestLength=score;}
  }
  const minX=Math.min(0,...[...best.values()].map(p=>p.x))-40,minY=Math.min(0,...[...best.values()].map(p=>p.y))-50;for(const p of best.values()){p.x-=minX;p.y-=minY;}
  const width=Math.max(500,...[...best.values()].map(p=>p.x+220)),height=Math.max(350,...[...best.values()].map(p=>p.y+55));
  const lengths=edges.map(e=>length(curve(best.get(e.source),best.get(e.target),mode)));
  const result={...base,layers,points:best,width,height,mode,metrics:{total:bestLength,before,saved:before?(before-bestLength)/before*100:0,average:edges.length?bestLength/edges.length:0,max:Math.max(0,...lengths),crossings:crossings(best,edges,mode),area:width*height,overlaps:!valid(best)}};
  cache.set(key,result);return result;
}
