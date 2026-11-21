import {T,W,H} from './config.js';
export function makeWorld(level){const solid=new Set();for(let x=0;x<32;x++){solid.add(`${x},0`);solid.add(`${x},17`)}for(let y=0;y<18;y++){solid.add(`0,${y}`);solid.add(`31,${y}`)}for(const [x,y,w,h] of level.walls)for(let a=x;a<x+w;a++)for(let b=y;b<y+h;b++)solid.add(`${a},${b}`);for(const [x,y] of level.crates)solid.add(`${x},${y}`);return {level,solid};}
export const center=([x,y])=>({x:(x+.5)*T,y:(y+.5)*T});
export function blocked(world,x,y){return x<0||y<0||x>=W||y>=H||world.solid.has(`${Math.floor(x/T)},${Math.floor(y/T)}`)}
export function clearLine(world,x1,y1,x2,y2){const d=Math.hypot(x2-x1,y2-y1),n=Math.ceil(d/5);for(let i=1;i<n;i++)if(blocked(world,x1+(x2-x1)*i/n,y1+(y2-y1)*i/n))return false;return true;}
export function darkAt(world,x,y){return world.level.dark.some(([a,b,w,h])=>x>=a*T&&x<(a+w)*T&&y>=b*T&&y<(b+h)*T)}
export function moveBody(world,body,dx,dy,r=12){for(const [axis,delta] of [['x',dx],['y',dy]]){const x=body.x+(axis==='x'?delta:0),y=body.y+(axis==='y'?delta:0);if(![[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(([a,b])=>blocked(world,a,b)))body[axis]+=delta;}}
