import { WIDTH, HEIGHT, clamp, pathY, lerp } from './world.js';
import { PeoplePainter } from './people.js';
import { createStreetLife, updateStreetLife } from './street-life.js';
import { drawUmbrella } from './umbrellas.js';
import { drawNightLighting } from './night-lighting.js';
import { drawActivity } from './activity-view.js';
import { drawFerryDocks } from './ferry-view.js';

const palette = ['#a16d56','#64776a','#7e8e8a','#b79a6b','#807366','#857c93','#8d6552'];
const random = n => { const r=Math.sin(n*127.1+311.7)*43758.5453; return r-Math.floor(r); };
export class Renderer {
  constructor(canvas,image,world) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.image=image;this.world=world;
    this.width=0;this.height=0;this.scale=1;this.zoom=1;this.camera=world.x;this.cameraY=640;this.follow=true;
    this.night=0;this.rain=0;this.ripples=[];this.umbrellaCount=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.people=new PeoplePainter();this.npcs=createStreetLife();this.crowdTime=world.time;
  }
  resize() {
    this.width=innerWidth;this.height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.scale=Math.max(this.height/HEIGHT,this.width/WIDTH)*this.zoom; this.constrain();
  }
  constrain(){const half=this.width/this.scale/2;this.camera=clamp(this.camera,Math.min(half,WIDTH/2),Math.max(WIDTH-half,WIDTH/2));const hy=this.height/this.scale/2;this.cameraY=clamp(this.cameraY,hy,HEIGHT-hy);}
  point(x,y){return {x:(x-this.camera)*this.scale+this.width/2,y:(y-this.cameraY)*this.scale+this.height/2};}
  toWorld(x,y){return {x:(x-this.width/2)/this.scale+this.camera,y:(y-this.height/2)/this.scale+this.cameraY};}
  setZoom(value,anchor){const before=anchor?this.toWorld(anchor.x,anchor.y):null;this.zoom=clamp(value,1,2.8);this.resize();if(before){const after=this.toWorld(anchor.x,anchor.y);this.camera+=before.x-after.x;this.cameraY+=before.y-after.y;this.constrain();}}
  ripple(x,y){this.ripples.push({x,y,age:0});if(this.ripples.length>25)this.ripples.shift();}
  person(x,y,color,steps,face=1,hero=false,action='walk',options={}) {
    if(!options.local&&(x<this.camera-this.width/this.scale/2-100||x>this.camera+this.width/this.scale/2+100))return;
    const c=this.ctx;
    c.save();c.translate(x,y);c.fillStyle='#423b3021';c.beginPath();c.ellipse(0,1,hero?12:9,2.5,0,0,Math.PI*2);c.fill();
    if(hero){c.strokeStyle='#a4523c70';c.lineWidth=.8;c.beginPath();c.ellipse(0,2,15,4,0,0,Math.PI*2);c.stroke();}c.restore();
    const variant=options.avatar??(hero?0:color==='#73674d'?5:1);
    const height=options.height??(hero?73:65);
    const moving=options.moving??(hero?Math.abs(this.world.v)>1:false);
    if(!this.people.draw(c,{x,y,variant,height,phase:steps,face,moving,time:this.world.time,action,progress:options.progress??0})){
      this.fallbackPerson(x,y,color,steps,face,hero,action);
      return;
    }
    if(action==='tea'){
      const sipAge=this.world.activity.choice==='sip'?this.world.time-this.world.activity.choiceAt:5;
      const lift=sipAge<2.5?Math.sin(sipAge/2.5*Math.PI)*14:0;
      c.save();c.translate(x,y);c.scale(face,1);const cupY=-34-lift;
      c.strokeStyle='#705b42';c.lineWidth=1;c.fillStyle='#ede0c2';c.beginPath();c.moveTo(8,cupY);c.lineTo(15,cupY);c.lineTo(14,cupY+4);c.lineTo(9,cupY+4);c.closePath();c.fill();c.stroke();
      c.strokeStyle='#f1e8d4a3';for(let i=0;i<2;i++){const drift=Math.sin(this.world.time*1.2+i)*2;c.beginPath();c.moveTo(10+i*3,cupY-3);c.quadraticCurveTo(7+drift+i*3,cupY-8,11+drift+i*3,cupY-13);c.stroke();}c.restore();
    }
    if(!options.local&&options.umbrella!==false&&action!=='tea'&&this.rain>.025){
      if(drawUmbrella(c,{x,y,height,face,variant,time:this.world.time,rain:this.rain,reduced:this.reduced}))this.umbrellaCount++;
    }
  }
  fallbackPerson(x,y,color,steps,face=1,hero=false,action='walk') {
    const c=this.ctx; if(x<this.camera-this.width/this.scale/2-90||x>this.camera+this.width/this.scale/2+90)return;
    const stride=Math.sin(steps)*5;const sway=Math.cos(steps*2)*.7;c.save();c.translate(x,y);c.scale(face,1);
    c.fillStyle='#443e3324';c.beginPath();c.ellipse(0,1,12,3,0,0,Math.PI*2);c.fill();
    if(hero){c.strokeStyle='#a4523c70';c.lineWidth=1;c.beginPath();c.ellipse(0,2,17,5,0,0,Math.PI*2);c.stroke();}
    c.lineWidth=2.4;c.strokeStyle='#403b32';c.lineCap='round';
    c.beginPath();c.moveTo(-4,-13);c.lineTo(-4-stride,-2);c.lineTo(-1-stride,0);c.moveTo(4,-13);c.lineTo(4+stride,-2);c.lineTo(8+stride,0);c.stroke();
    c.translate(0,sway);c.strokeStyle='#4c4435';c.lineWidth=1.1;c.fillStyle=color;c.beginPath();c.moveTo(-7,-43);c.quadraticCurveTo(-11,-25,-12,-13);c.quadraticCurveTo(0,-9,11,-14);c.lineTo(7,-43);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#4b4337';c.beginPath();c.moveTo(-2,-40);c.lineTo(4,-33);c.lineTo(2,-13);c.stroke();c.strokeStyle='#574938';c.lineWidth=2;c.beginPath();c.moveTo(-8,-28);c.lineTo(8,-28);c.stroke();
    c.fillStyle=color;c.strokeStyle='#4b4439';c.lineWidth=1;c.beginPath();c.moveTo(-7,-40);c.quadraticCurveTo(-15,-32,-13+stride*.4,-24);c.lineTo(-7,-25);c.lineTo(-2,-37);c.fill();c.stroke();
    c.beginPath();c.moveTo(6,-40);c.lineTo(action==='tea'?17:14-stride*.6,action==='tea'?-36:-27);c.lineTo(action==='tea'?13:9-stride*.6,action==='tea'?-32:-24);c.lineTo(1,-36);c.fill();c.stroke();
    c.fillStyle='#c9ac83';c.beginPath();c.ellipse(1,-49,6,8,0,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#3e3b34';c.beginPath();c.ellipse(0,-55,7,4,0,Math.PI,Math.PI*2);c.fill();c.beginPath();c.arc(-1,-60,2.5,0,Math.PI*2);c.fill();c.fillRect(4,-50,1,1);
    if(hero){c.fillStyle='#40535b';c.fillRect(-8,-56,16,3);c.beginPath();c.moveTo(-6,-57);c.lineTo(-4,-63);c.lineTo(5,-63);c.lineTo(7,-57);c.fill();}
    if(action==='tea'){c.fillStyle='#e3d1ae';c.fillRect(13,-36,8,5);c.strokeRect(13,-36,8,5);c.strokeStyle='#e4dfcc';c.beginPath();c.moveTo(18,-39);c.quadraticCurveTo(13,-45,18,-50);c.stroke();}
    c.restore();
  }
  boat(x,y,t,large=false,mast=1,options={}){
    const c=this.ctx;c.save();c.translate(x,y+(this.reduced||options.bob===false?0:Math.sin(t*1.5)*2));if(large)c.scale(1.8,1.45);
    c.globalAlpha=.2;c.fillStyle='#536961';c.beginPath();c.ellipse(0,16,79,9,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    c.save();c.scale(options.face??1,1);
    c.fillStyle='#8b6b46';c.strokeStyle='#514531';c.lineWidth=1.5;c.beginPath();c.moveTo(-78,-4);c.lineTo(-63,10);c.quadraticCurveTo(0,20,67,7);c.lineTo(81,-7);c.quadraticCurveTo(4,2,-78,-4);c.fill();c.stroke();
    c.strokeStyle='#b3976a';c.beginPath();c.moveTo(-60,1);c.quadraticCurveTo(0,9,65,0);c.stroke();
    c.fillStyle='#b5a17e';c.beginPath();c.moveTo(-34,-7);c.quadraticCurveTo(-29,-43,3,-42);c.quadraticCurveTo(35,-40,40,-7);c.closePath();c.fill();c.strokeStyle='#726346';c.stroke();
    for(let i=-24;i<35;i+=10){c.beginPath();c.moveTo(i,-8);c.quadraticCurveTo(i-5,-34,i-11,-36);c.stroke();}
    if(large){c.save();c.translate(-8,-10);c.rotate((1-mast)*-1.4);c.strokeStyle='#5e4e34';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(0,-98);c.stroke();c.fillStyle='#c4b496';c.beginPath();c.moveTo(3,-94);c.lineTo(39,-84);c.lineTo(42,-32);c.lineTo(3,-35);c.fill();c.lineWidth=.7;c.stroke();c.restore();}
    // Timber strakes and a woven canopy give the moving boat the same material
    // detail as the painted quay, without requesting another large asset.
    c.lineWidth=.7;c.strokeStyle='#56483180';for(let row=0;row<3;row++){c.beginPath();c.moveTo(-56,4+row*3);c.quadraticCurveTo(0,10+row*2,55,3+row*3);c.stroke();}
    c.strokeStyle='#8b76564d';for(let row=0;row<4;row++){c.beginPath();c.moveTo(-25,-11-row*6);c.quadraticCurveTo(2,-17-row*6,30,-10-row*6);c.stroke();}
    c.restore();
    this.person(-53,-6,'#73674d',0,-1,false,'idle',{local:true,avatar:5,height:53,moving:false});
    const stroke=Math.sin(t*1.8);c.strokeStyle='#6d5b3d';c.lineWidth=2;c.beginPath();c.moveTo(-57,-30);c.lineTo(-91+stroke*12,27);c.stroke();c.lineWidth=4;c.beginPath();c.moveTo(-91+stroke*12,24);c.lineTo(-97+stroke*12,31);c.stroke();
    c.strokeStyle='#dddac58c';c.lineWidth=.8;for(let wake=0;wake<3;wake++){const radius=18+(t*13+wake*19)%48;c.globalAlpha=1-radius/70;c.beginPath();c.ellipse(-92+stroke*12,30,radius,radius*.18,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;c.restore();
  }
  render(dt,nightTarget,rainTarget){
    const w=this.world,c=this.ctx;this.night=lerp(this.night,nightTarget,Math.min(1,dt*1.4));this.rain=lerp(this.rain,rainTarget,Math.min(1,dt*1.3));
    if(this.follow){this.camera=lerp(this.camera,w.x,Math.min(1,dt*3));if(this.zoom>1)this.cameraY=lerp(this.cameraY,w.y-130,Math.min(1,dt*2));this.constrain();}
    c.clearRect(0,0,this.width,this.height);c.save();c.translate(this.width/2,this.height/2);c.scale(this.scale,this.scale);c.translate(-this.camera,-this.cameraY);
    c.drawImage(this.image,0,0,WIDTH,HEIGHT);
    const t=w.time;this.umbrellaCount=0;
    const crowdDt=clamp(t-this.crowdTime,0,.05);this.crowdTime=t;
    if(!this.reduced)updateStreetLife(this.npcs,crowdDt);
    // Moving reflections are confined to the foreground river.
    if(!this.reduced){c.save();c.beginPath();c.rect(0,905,WIDTH,375);c.clip();c.lineWidth=1;
      for(let i=0;i<145;i++){const x=(random(i+60)*WIDTH+t*5+Math.sin(t*.35+i)*18)%WIDTH,y=920+random(i+120)*350;c.strokeStyle=`rgba(238,230,204,${(.06+random(i+90)*.13)*(1+Math.sin(t*.8+i)*.2)})`;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+18,y+Math.sin(t+i),x+25+random(i)*45,y);c.stroke();}
      if(this.rain>.02){for(let i=0;i<55;i++){const age=(t*.7+random(i+150))%1;c.strokeStyle=`rgba(235,233,208,${this.rain*(1-age)*.24})`;c.beginPath();c.ellipse(random(i+190)*WIDTH,930+random(i+240)*320,2+age*14,1+age*3,0,0,Math.PI*2);c.stroke();}}c.restore();}
    drawFerryDocks(c,{world:w,time:t,reduced:this.reduced,foreground:false});
    this.boat(360+Math.sin(t*.045)*130,1040,t);this.boat(3290+Math.sin(t*.035+2)*100,1160,t+6);
    this.boat(w.ferry.x,w.ferry.y,t,false,1,{face:w.ferry.face,bob:false});
    const story=w.story;
    if(story.phase!=='idle'){
      const x=story.phase==='lowering'?2120:lerp(2120,2820,story.progress/100);
      this.boat(x,923,t,true,story.phase==='lowering'?1-story.progress/100:0);
      if(story.phase==='towing'){c.strokeStyle='#706148';c.lineWidth=1.5;c.beginPath();c.moveTo(x-115,908);c.lineTo(w.x,pathY(w.x)-35);c.stroke();}
    }
    for(const n of this.npcs){this.person(n.x,pathY(n.x)+n.lane,palette[n.avatar],n.steps,n.face,false,'walk',{avatar:n.avatar,height:n.height,moving:Math.abs(n.velocity)>1,umbrella:!n.stationary});}
    if(w.mode!=='feed')this.activityView=drawActivity(c,{world:w,time:t,reduced:this.reduced});
    if(w.mode==='tea'){
      const side=w.face<0?-1:1;
      this.person(w.x+side*132,w.y,'#857c93',0,-side,false,'idle',{avatar:4,height:65,moving:false,umbrella:false});
      const lift=w.timer<1.8&&!this.reduced?Math.sin(clamp(w.timer/1.8,0,1)*Math.PI)*12:0;
      c.save();c.translate(w.x,w.y);c.scale(side,1);c.strokeStyle='#65513f';c.lineWidth=.8;c.fillStyle='#96836d';
      c.beginPath();c.moveTo(128,-44);c.quadraticCurveTo(118,-36,103,-39-lift);c.lineTo(100,-45-lift);c.quadraticCurveTo(118,-42,125,-50);c.closePath();c.fill();c.stroke();
      c.fillStyle='#c7ac87';c.beginPath();c.ellipse(100,-43-lift,3,2.1,0,0,Math.PI*2);c.fill();c.restore();
    }
    const pose=w.pose;
    this.person(w.x,w.y,'#52717a',pose?.steps??w.steps,w.face,true,pose?.action??w.mode,{progress:pose?.progress??0,moving:pose?.walking??Math.abs(w.v)>1});
    drawFerryDocks(c,{world:w,time:t,reduced:this.reduced,foreground:true});
    // The bridge foreground covers feet on the walkway rather than leaving
    // every visitor visibly pasted above the painted rail.
    if(this.camera+this.width/this.scale/2>2030&&this.camera-this.width/this.scale/2<2880){
      c.save();c.beginPath();for(let x=2030;x<=2880;x+=10){const y=pathY(x)-8;if(x===2030)c.moveTo(x,y);else c.lineTo(x,y);}for(let x=2880;x>=2030;x-=10)c.lineTo(x,pathY(x)+20);c.closePath();c.clip();c.drawImage(this.image,0,0,WIDTH,HEIGHT);c.restore();
    }
    if(w.mode==='feed')this.activityView=drawActivity(c,{world:w,time:t,reduced:this.reduced});
    drawNightLighting(c,{night:this.night,time:t,reduced:this.reduced,width:WIDTH,height:HEIGHT,image:this.image});
    if(this.rain>.01){c.fillStyle=`rgba(77,94,94,${this.rain*.15})`;c.fillRect(0,0,WIDTH,HEIGHT);}
    this.ripples=this.ripples.filter(r=>r.age<2.5);for(const r of this.ripples){r.age+=dt;c.strokeStyle=`rgba(238,235,207,${(1-r.age/2.5)*.6})`;c.lineWidth=1.2;for(let j=0;j<3;j++){const radius=r.age*28+j*9;c.beginPath();c.ellipse(r.x,r.y,radius,radius*.28,0,0,Math.PI*2);c.stroke();}}
    c.restore();
    if(this.rain>.01&&!this.reduced){c.strokeStyle=`rgba(227,232,226,${this.rain*.6})`;c.lineWidth=.8;for(let i=0;i<170;i++){const x=(random(i+55)*this.width-t*65+this.width*100)%this.width,y=(random(i+82)*this.height+t*(350+random(i)*100))%this.height;c.beginPath();c.moveTo(x,y);c.lineTo(x-5,y+13+random(i)*13);c.stroke();}}
  }
  sketch(){
    const out=document.createElement('canvas');out.width=1600;out.height=1000;const c=out.getContext('2d');c.fillStyle='#eee3cb';c.fillRect(0,0,1600,1000);
    c.fillStyle='#61513b';c.font='38px serif';c.fillText('虹桥过船',70,85);c.font='16px serif';c.fillText('汴河 · 一日千年　|　亲历留稿',70,125);
    // Draw the completed bridge scene independently of the current viewport.
    c.drawImage(this.image,this.image.width*.48,this.image.height*.25,this.image.width*.32,this.image.height*.65,60,165,1480,760);
    c.strokeStyle='#92795b70';c.strokeRect(60,165,1480,760);c.fillStyle='#a4523c';c.fillRect(1430,50,70,70);c.fillStyle='#efe5cf';c.font='26px serif';c.fillText('亲历',1437,95);
    c.font='14px serif';c.fillStyle='#8a785f';c.fillText('清明上河 · 交互长卷复刻',60,970);
    // Ship and rope record the successfully completed passage.
    c.save();c.translate(1080,780);c.scale(1.5,1.5);c.fillStyle='#8b6b46';c.strokeStyle='#59472e';c.beginPath();c.moveTo(-100,0);c.lineTo(-70,30);c.lineTo(75,30);c.lineTo(110,-3);c.closePath();c.fill();c.stroke();c.fillStyle='#b5a17e';c.beginPath();c.moveTo(-45,0);c.quadraticCurveTo(0,-60,48,0);c.fill();c.stroke();c.beginPath();c.moveTo(-12,-4);c.lineTo(-85,-28);c.stroke();c.restore();return out.toDataURL('image/png');
  }
}
