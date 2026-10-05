const COLORS=['#ba9a6c','#af8062','#829285','#bcaa82','#9d7464'];

export function drawUmbrella(ctx,{x,y,height=70,face=1,variant=0,time=0,rain=1,reduced=false}){
  const opacity=Math.min(1,Math.max(0,(rain-.025)*1.7));
  if(opacity<=0)return false;
  const sway=reduced?0:Math.sin(time*1.3+variant)*.012;
  const center=face*10,top=-height-5,radius=29+height*.03;
  ctx.save();ctx.translate(x,y);ctx.rotate(sway);ctx.globalAlpha=opacity;
  // Bamboo pole and shallow paper canopy match the scroll's painted materials.
  ctx.strokeStyle='#67533d';ctx.lineWidth=1.05;ctx.beginPath();ctx.moveTo(center,top+8);ctx.lineTo(center,-29);ctx.quadraticCurveTo(center+face*4,-26,center+face*5,-30);ctx.stroke();
  const fabric=ctx.createLinearGradient(0,top-17,0,top+14);
  fabric.addColorStop(0,'#d7c29a');fabric.addColorStop(.45,COLORS[variant%COLORS.length]);fabric.addColorStop(1,'#90795d');
  ctx.fillStyle=fabric;ctx.strokeStyle='#695a43b3';ctx.lineWidth=.85;
  ctx.beginPath();ctx.moveTo(center-radius,top+13);ctx.quadraticCurveTo(center-radius*.6,top-6,center,top-15);ctx.quadraticCurveTo(center+radius*.6,top-6,center+radius,top+13);ctx.quadraticCurveTo(center+radius*.45,top+9,center,top+12);ctx.quadraticCurveTo(center-radius*.45,top+9,center-radius,top+13);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#65573d66';ctx.lineWidth=.65;
  for(let rib=-3;rib<=3;rib++){const end=center+rib*radius/3;ctx.beginPath();ctx.moveTo(center,top-15);ctx.quadraticCurveTo(center+rib*radius*.16,top-1,end,top+12);ctx.stroke();}
  ctx.fillStyle='#695a43';ctx.beginPath();ctx.ellipse(center,top-15,1.4,2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#baa080';ctx.beginPath();ctx.ellipse(center,-32,2,1.5,0,0,Math.PI*2);ctx.fill();
  ctx.restore();return true;
}
