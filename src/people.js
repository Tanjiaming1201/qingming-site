// Six independently generated watercolor figures. All bounds are measured in
// the original transparent PNG; the image is never flattened onto a backdrop.
const FIGURES = [
  [65,41,315,682], [409,67,671,676], [790,55,1034,677],
  [1133,47,1382,682], [1491,64,1744,672], [1880,56,2115,679],
];
const FRAME_HEIGHT=160;
const FRAME_COUNT=20;
const PADDING=12;

export class PeoplePainter {
  constructor(){
    this.ready=false;
    this.frames=new Map();
    this.image=new Image();
    this.image.decoding='async';
    this.image.onload=()=>{this.ready=true;};
    this.image.onerror=()=>{this.ready=false;};
    this.image.src=new URL('../assets/people-v2.png',import.meta.url).href;
  }

  frame(variant,index){
    const key=`${variant}:${index}`;
    if(this.frames.has(key))return this.frames.get(key);
    const [x0,y0,x1,y1]=FIGURES[variant];
    const sw=x1-x0,sh=y1-y0;
    const dw=sw/sh*FRAME_HEIGHT;
    const frame=document.createElement('canvas');
    frame.width=Math.ceil(dw+PADDING*2);
    frame.height=FRAME_HEIGHT+PADDING*2;
    const ctx=frame.getContext('2d');
    const phase=index<FRAME_COUNT?index/FRAME_COUNT*Math.PI*2:0;
    const moving=index<FRAME_COUNT;
    const left=(frame.width-dw)/2;
    // Deform thin horizontal bands and cache the result. Gait advances with
    // distance, so the robe and shoes settle immediately when movement stops.
    for(let y=0;y<FRAME_HEIGHT;y+=2){
      const h=Math.min(2,FRAME_HEIGHT-y),p=y/FRAME_HEIGHT;
      const sourceY=y0+p*sh,sourceH=h/FRAME_HEIGHT*sh;
      const sway=moving?Math.sin(phase)*Math.pow(p,2)*2.2:0;
      if(p>.89&&moving){
        const stride=Math.sin(phase)*3.5;
        for(let half=0;half<2;half++){
          const shift=half===0?stride:-stride;
          const lift=-Math.max(0,half===0?Math.sin(phase):Math.sin(phase+Math.PI))*1.3;
          ctx.drawImage(this.image,x0+sw*half/2,sourceY,sw/2,sourceH,left+dw*half/2+shift,PADDING+y+lift,dw/2,h);
        }
      }else{
        ctx.drawImage(this.image,x0,sourceY,sw,sourceH,left+sway,PADDING+y,dw,h);
      }
    }
    this.frames.set(key,frame);
    return frame;
  }

  draw(ctx,{x,y,variant=0,height=70,phase=0,face=1,moving=false,time=0,action='walk',progress=0}){
    if(!this.ready)return false;
    variant=Math.max(0,Math.min(FIGURES.length-1,variant));
    const index=moving?Math.floor(((phase%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*FRAME_COUNT):FRAME_COUNT;
    const frame=this.frame(variant,index);
    const scale=height/FRAME_HEIGHT;
    const breathing=Math.sin(time*1.5+variant)*.0015;
    const lean=action==='feed'?Math.sin(Math.min(1,progress)*Math.PI)*.06:action==='tea'?.035:0;
    ctx.save();ctx.translate(x,y);ctx.scale(face*scale,scale*(1+breathing));ctx.rotate(lean);
    ctx.drawImage(frame,-frame.width/2,-FRAME_HEIGHT-PADDING);
    ctx.restore();return true;
  }
}
