import { clamp } from './world.js';
const random=n=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};

export function createStreetLife(){
  const people=[];
  const shops=[580,1050,1410,1660,3020,3235,3530,3670];
  for(let i=0;i<shops.length;i++)people.push({x:shops[i],lane:-19,avatar:i%2?4:3,height:61+random(i)*5,stationary:true,face:i%2?-1:1,steps:0,wait:0,velocity:0});
  for(let i=0;i<17;i++){
    const center=130+i*211;
    const span=95+random(i+11)*175;
    const low=clamp(center-span,55,3785),high=clamp(center+span,55,3785);
    people.push({x:center,low,high,target:i%2?low:high,lane:i%3===0?5:-7,avatar:[2,1,4,2,3][i%5],height:62+random(i+4)*9,stationary:false,face:i%2?-1:1,steps:random(i)*Math.PI*2,wait:random(i+6)*5,velocity:0,speed:30+random(i+9)*27});
  }
  return people;
}

export function updateStreetLife(people,dt){
  for(const person of people){
    if(person.stationary)continue;
    if(person.wait>0){person.wait=Math.max(0,person.wait-dt);continue;}
    const distance=person.target-person.x;
    if(Math.abs(distance)<1.5){person.x=person.target;person.target=person.target===person.high?person.low:person.high;person.wait=1.5+random(person.x)*4;person.velocity=0;continue;}
    const wanted=Math.sign(distance)*person.speed*Math.min(1,Math.sqrt(Math.abs(distance)/28));
    person.velocity+=clamp(wanted-person.velocity,-100*dt,100*dt);
    const next=person.x+person.velocity*dt;
    const x=(person.target-person.x)*(person.target-next)<=0?person.target:next;
    person.steps+=Math.abs(x-person.x)*.085;
    person.x=x;
    if(Math.abs(person.velocity)>1)person.face=Math.sign(person.velocity);
  }
}
