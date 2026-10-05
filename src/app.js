import { World, WIDTH, HEIGHT, PLACES, clamp, pathY } from './world.js';
import { Renderer } from './render.js';
import { Soundscape } from './audio.js';
import { ActivityUI } from './activity-ui.js';

const $=id=>document.getElementById(id);
const world=new World(),sound=new Soundscape(),image=$('panorama');
const renderer=new Renderer($('scene'),image,world);
const activityUI=new ActivityUI(world,sound,()=>{stopInputs();$('scene').focus({preventScroll:true});toast('歇过脚，继续沿河漫游。');updateUI();});
const keys=new Set(),capturedPointers=new Map();let entered=false,ready=false,night=false,rain=false,rainUntil=0,last=performance.now(),uiClock=0,toastUntil=0;
let drag=null,sketchUrl=null,previousStory='idle',modalPause=false;
let hotspotCamera=null,hotspotCameraY=null,hotspotMotionUntil=0,hotspotsMoving=false;
const paths={
  boat:'M3 15h18l-4 5H7Zm9-12v12M5 12q7-7 14 0',
  moon:'M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11ZM17 3v4m-2-2h4',
  rain:'M5 13a3 3 0 0 1-1-6 5 5 0 0 1 9-2 4 4 0 0 1 7 6H5Zm3 3-2 4m7-4-2 4m7-4-2 4',
  bridge:'M3 15q9-16 18 0M2 17h20M6 11v6m6-10v10m6-6v6',
  follow:'M12 3v3m0 12v3M3 12h3m12 0h3M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  zoom:'M15 15l6 6M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM7 10h6m-3-3v6',
  sound:'M3 9h4l5-4v14l-5-4H3Zm12-1q4 4 0 8m3-11q6 7 0 14',
  pause:'M9 5v14m6-14v14',
  fullscreen:'M8 4H4v4m12-4h4v4M4 16v4h4m8 0h4v-4',
};
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[el.dataset.icon]}"></path></svg>`;});

function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=performance.now()+4200;}
function pressed(id,value){$(id).setAttribute('aria-pressed',String(value));}
function setPause(value){world.paused=value;pressed('pause',value);$('pause').setAttribute('aria-label',value?'继续动画':'暂停动画');$('pause').title=value?'继续动画':'暂停动画';}
function capturePointer(el,e){el.setPointerCapture(e.pointerId);capturedPointers.set(e.pointerId,el);}
function stopInputs(){
  keys.clear();world.story.holding=false;drag=null;pointers.clear();pinchDistance=0;
  for(const [id,el] of capturedPointers)if(el.hasPointerCapture(id))el.releasePointerCapture(id);
  capturedPointers.clear();
}
function enter(index){
  if(!ready)return;stopInputs();world.cancel();world.leaveStory();world.mode='walk';world.transfer=null;world.ferry.phase='idle';world.x=PLACES[index].x;world.v=0;setPause(false);previousStory='idle';
  entered=true;$('atlas').hidden=true;$('painting').hidden=false;renderer.camera=world.x;renderer.cameraY=HEIGHT/2;renderer.follow=true;zoom(1);$('scene').focus({preventScroll:true});
  sound.unlock().catch(()=>{});activityUI.update();toast('客官，请入画。左右行走，点击街道前往。');measureHotspots();updateUI();updateHotspots(performance.now());
}
document.querySelectorAll('.atlas-places [data-place]').forEach(el=>el.addEventListener('click',()=>enter(Number(el.dataset.place))));
document.querySelectorAll('.district-stops [data-place]').forEach(el=>el.addEventListener('click',()=>{renderer.camera=PLACES[Number(el.dataset.place)].x;renderer.follow=false;renderer.cameraY=640;renderer.constrain();}));
$('return').addEventListener('click',()=>{stopInputs();world.cancel();world.endActivity();activityUI.update();entered=false;$('painting').hidden=true;$('atlas').hidden=false;$('atlas').querySelector('button[data-place]').focus();sound.update(false,0,false);});
$('painting').addEventListener('pointerdown',()=>{sound.unlock().catch(()=>{});},{capture:true});

function loaded(){ready=true;$('load-status').textContent='点一处风景，走进画中';document.querySelectorAll('.atlas-places button').forEach(b=>b.disabled=false);}
image.addEventListener('load',loaded);image.addEventListener('error',()=>{ready=false;$('load-status').textContent='画卷未能展开 · 点击这里重试';$('load-status').style.cursor='pointer';});
$('load-status').addEventListener('click',()=>{if(!ready)image.src=`assets/panorama.webp?retry=${Date.now()}`;});
document.querySelectorAll('.atlas-places button').forEach(b=>b.disabled=!ready);
if(image.complete&&image.naturalWidth)loaded();

const hotspots=[
  {id:'tea',label:'歇脚饮茶',x:1267,y:pathY(1267)-65,action:()=>go(1267,'tea')},
  {id:'feed',label:'桥头喂鸟',x:2150,y:pathY(2150)-65,action:()=>go(2150,'feed')},
  {id:'dock',label:'码头唤船',x:1810,y:824,action:()=>callFerry(1810)},
  {id:'dock-east',label:'码头唤船',x:2990,y:824,action:()=>callFerry(2990)},
  {id:'shop',label:'询问集市',x:3420,y:pathY(3420)-65,action:()=>go(3420,'shop')},
  {id:'board',label:'沿栈桥上船 ↓',x:1810,y:909,action:()=>{if(canBoard()&&world.board())renderer.follow=true;}},
];
for(const h of hotspots){const button=document.createElement('button');button.className='hotspot';button.id=`hotspot-${h.id}`;button.textContent=h.label;button.setAttribute('aria-label',h.label);button.addEventListener('click',h.action);$('interactions').append(button);h.el=button;h.onScreen=false;h.position='';h.halfWidth=0;button.hidden=true;}
function go(x,action){if(world.go(x,action)){renderer.follow=true;toast(action==='tea'?'慢慢走，到茶铺歇歇脚。':action==='feed'?'到桥头，撒一把谷粒。':'去货市与店家聊聊。');}}
function callFerry(x){if(x!==undefined&&world.mode==='walk'&&world.story.phase==='idle'){world.go(x,'ferry');world.ferry.phase='idle';world.ferry.from=x;world.ferry.to=x===1810?2990:1810;toast('到码头，唤船来。');renderer.follow=true;}else if(world.callFerry())renderer.follow=true;else toast('此刻正在游玩，结束后再招船。');}
$('ferry').addEventListener('click',()=>callFerry());
function canBoard(){return world.ferry.phase==='ready'&&world.mode==='walk'&&world.story.phase==='idle'&&Math.abs(world.x-world.ferry.from)<=20;}
function nearestInteraction(){
  if(world.mode!=='walk'||world.story.phase!=='idle')return;
  sound.unlock().catch(()=>{});
  if(canBoard()){if(world.board())renderer.follow=true;return;}
  const nearby=hotspots.filter(h=>h.id!=='board').sort((a,b)=>Math.abs(world.x-a.x)-Math.abs(world.x-b.x));
  if(Math.abs(nearby[0].x-world.x)<180)nearby[0].action();else toast('走近茶铺、桥头或码头，再按 E 互动。');
}

function heldWalk(id,key){
  const el=$(id);el.addEventListener('pointerdown',e=>{if(e.button!==0||world.mode!=='walk'||world.story.phase!=='idle')return;e.preventDefault();capturePointer(el,e);keys.add(key);world.cancel();renderer.follow=true;});
  const release=e=>{keys.delete(key);capturedPointers.delete(e.pointerId);};el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
}
heldWalk('left','ArrowLeft');heldWalk('right','ArrowRight');
$('play').addEventListener('click',()=>{
  if(['sailing','boarding','disembark'].includes(world.mode)){setPause(!world.paused);return;}
  if(world.mode!=='walk'||world.story.phase!=='idle'){toast('正在歇脚，片刻后再走。');return;}
  world.target=null;world.action=null;world.auto=!world.auto;setPause(false);renderer.follow=true;
});
$('night').addEventListener('click',()=>{night=!night;pressed('night',night);document.body.classList.toggle('night',night);toast(night?'灯火渐明，汴河入夜。':'天光初起，街市如常。');});
$('rain').addEventListener('click',()=>{rain=!rain;rainUntil=world.time+65;pressed('rain',rain);toast(rain?'清明时雨，且听雨落。':'雨歇天青，水声依旧。');});
$('sound').addEventListener('click',async()=>{try{const enabled=await sound.toggle();pressed('sound',enabled);$('sound').setAttribute('aria-label',enabled?'关闭全部声音':'开启声音');$('sound').title=enabled?'关闭全部声音':'开启声音';toast(enabled?'弦声、鸟鸣与春雨，一同入画。':'全部声音已关闭。');}catch{toast('此浏览器暂时无法播放声音。');}});
$('pause').addEventListener('click',()=>{setPause(!world.paused);toast(world.paused?'时光暂歇。':'继续游卷。');});
$('follow').addEventListener('click',()=>{renderer.follow=true;toast(world.mode==='sailing'?'回到船上。':'回到画中行人。');});
function zoom(value,anchor){renderer.setZoom(value,anchor);pressed('zoom',renderer.zoom>1.1);}
$('zoom').addEventListener('click',()=>zoom(renderer.zoom>1.1?1:1.8));
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器未开启全屏支持。');}});
$('position').addEventListener('input',e=>{renderer.camera=Number(e.target.value)/1000*WIDTH;renderer.follow=false;renderer.constrain();});

$('bridge').addEventListener('click',()=>{if(world.startStory()){stopInputs();setPause(false);renderer.follow=true;zoom(1);previousStory='idle';$('scene').focus({preventScroll:true});updateUI();}else toast('先到岸上，再来参与虹桥过船。');});
const storyButton=$('story-action');
storyButton.addEventListener('pointerdown',e=>{if(e.button!==0||!['lowering','towing'].includes(world.story.phase))return;e.preventDefault();world.story.holding=true;capturePointer(storyButton,e);});
['pointerup','pointercancel','lostpointercapture'].forEach(event=>storyButton.addEventListener(event,e=>{world.story.holding=false;capturedPointers.delete(e.pointerId);}));
storyButton.addEventListener('click',()=>{if(world.story.phase==='complete')openSketch();});
storyButton.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&world.story.phase!=='complete'){e.preventDefault();world.story.holding=true;}});
storyButton.addEventListener('keyup',()=>world.story.holding=false);
$('story-exit').addEventListener('click',()=>{stopInputs();world.leaveStory();previousStory='idle';$('scene').focus({preventScroll:true});updateUI();});
$('memo').addEventListener('click',openSketch);
function openSketch(){if(!sketchUrl)sketchUrl=renderer.sketch();$('sketch-image').src=sketchUrl;showDialog($('sketch-dialog'));}
$('save-sketch').addEventListener('click',()=>{if(!sketchUrl)return;const a=document.createElement('a');a.href=sketchUrl;a.download='清明上河-虹桥画稿.png';a.click();});

function showDialog(dialog){stopInputs();modalPause=world.paused;setPause(true);dialog.showModal();}
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelectorAll('.dialog-close,.dialog-close-bottom').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  dialog.addEventListener('close',()=>{setPause(modalPause);if(dialog.id==='sketch-dialog'&&world.story.phase==='complete')world.leaveStory();if(entered)$('scene').focus({preventScroll:true});});
});
const instructions=`<p>沿着汴河行走，去茶铺歇脚，在桥头喂鸟，或唤一叶小舟渡河。</p><dl class="keys"><dt>← → / A D</dt><dd>行走，松开后减速停下</dd><dt>点击街道</dt><dd>走到所选位置</dd><dt>拖动 / 滚轮</dt><dd>自由浏览画卷</dd><dt>双击 / 双指</dt><dd>放大细节，拖动看景</dd><dt>E</dt><dd>在茶铺、桥头或码头互动</dd><dt>空格 / Esc</dt><dd>暂停动画 / 停止行走</dd><dt>Home / End</dt><dd>浏览画卷起点 / 终点</dd></dl><p>「招船」会先带你走到码头，船靠岸后点击「上船」。乘船时，中间播放键可暂停或继续。</p><p>「过船」开启虹桥故事：按住落桅，再按住牵绳，也可按住左方向键牵引。完成后可以保存画稿。</p>`;
$('help').addEventListener('click',()=>{$('info-content').innerHTML=instructions;showDialog($('info-dialog'));});
$('about').addEventListener('click',()=>{$('info-content').innerHTML=`<p>这是参考「清明上河」交互项目重新实现的学习作品。街市插画重新生成，人物、水面与天气由独立编写的 Canvas 程序绘制。</p><p>参考项目：<a href="https://github.com/xianxie6/qingming-riverside" target="_blank" rel="noopener noreferrer">xianxie6 / qingming-riverside ↗</a></p><p>这幅画卷是宋代风物的艺术再创作，背景并非《清明上河图》原画扫描。店家对白与货价为游卷中的情境演绎。</p><p>饮茶、喂鸟和问询时会有短促音效。声音按钮可开启环境弦乐、雨声，再次点击可静音全部声音。</p>`;showDialog($('info-dialog'));});

document.addEventListener('keydown',e=>{
  if(!entered||document.querySelector('dialog[open]')||e.target.matches('input,textarea,select,[contenteditable="true"]'))return;
  if(e.target===storyButton)return;
  const code=e.code;
  if(['Space','Enter'].includes(code)&&e.target.closest('button,a,[role="button"]'))return;
  if(['ArrowLeft','ArrowRight','KeyA','KeyD','Space','Home','End'].includes(code))e.preventDefault();
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(code)){
    keys.add(code);if(world.story.phase==='lowering'||world.story.phase==='towing')world.story.holding=code==='ArrowLeft'||code==='KeyA';else{renderer.follow=true;world.cancel();}
  }
  if(e.repeat)return;
  if(code==='Space')setPause(!world.paused);
  if(code==='KeyE')nearestInteraction();
  if(code==='Escape'){stopInputs();if(world.story.phase!=='idle')world.leaveStory();else if(['tea','feed','shop'].includes(world.mode))activityUI.leave();else if(['sailing','boarding','disembark'].includes(world.mode))setPause(true);else world.cancel();}
  if(code==='Home'||code==='End'){renderer.follow=false;renderer.camera=code==='Home'?0:WIDTH;renderer.constrain();}
  if(code==='Enter'&&(world.story.phase==='lowering'||world.story.phase==='towing'))world.story.holding=!world.story.holding;
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(['ArrowLeft','KeyA'].includes(e.code))world.story.holding=false;});
window.addEventListener('blur',stopInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden){stopInputs();sound.update(false,0,night);}});

const pointers=new Map();let pinchDistance=0,pinchZoom=1;
$('scene').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;capturePointer($('scene'),e);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);pinchZoom=renderer.zoom;if(drag)drag.moved=true;return;}
  drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
});
$('scene').addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance>0){renderer.follow=false;zoom(pinchZoom*d/pinchDistance,{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});}return;}
  if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;
  if(drag.moved){renderer.follow=false;renderer.camera-=(e.clientX-drag.lastX)/renderer.scale;if(renderer.zoom>1)renderer.cameraY-=(e.clientY-drag.lastY)/renderer.scale;renderer.constrain();}
  drag.lastX=e.clientX;drag.lastY=e.clientY;
});
$('scene').addEventListener('pointerup',e=>{
  const count=pointers.size;pointers.delete(e.pointerId);capturedPointers.delete(e.pointerId);if(count>1){drag=null;return;}
  if(drag&&!drag.moved){const p=renderer.toWorld(e.clientX,e.clientY);if(p.y>902){renderer.ripple(p.x,p.y);if(rain)sound.cup();}
    else if(world.mode==='walk'&&world.story.phase==='idle'){const hit=hotspots.find(h=>h.id!=='board'&&Math.abs(h.x-p.x)<100&&Math.abs(p.y-pathY(h.x))<135);if(hit)hit.action();else if(p.y>450&&p.y<900){world.go(p.x);renderer.follow=true;}}
  }drag=null;
});
['pointercancel','lostpointercapture'].forEach(event=>$('scene').addEventListener(event,e=>{pointers.delete(e.pointerId);capturedPointers.delete(e.pointerId);drag=null;}));
$('scene').addEventListener('dblclick',e=>{zoom(renderer.zoom>1.1?1:1.8,{x:e.clientX,y:e.clientY});});
$('scene').addEventListener('wheel',e=>{e.preventDefault();renderer.follow=false;if(e.ctrlKey||e.metaKey)zoom(renderer.zoom*Math.exp(-e.deltaY*.002),{x:e.clientX,y:e.clientY});else{renderer.camera+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)/renderer.scale;renderer.constrain();}},{passive:false});
window.addEventListener('resize',()=>{renderer.resize();if(entered)measureHotspots();});document.addEventListener('fullscreenchange',()=>{renderer.resize();if(entered)measureHotspots();});

function updateUI(){
  const districtX=renderer.follow?world.x:renderer.camera;
  const district=PLACES.reduce((a,b)=>Math.abs(b.x-districtX)<Math.abs(a.x-districtX)?b:a);$('district-name').textContent=district.name;
  document.querySelectorAll('.district-stops button').forEach((el,i)=>el.classList.toggle('active',PLACES[i]===district));
  $('position').value=String(renderer.camera/WIDTH*1000);
  const riding=['sailing','boarding','disembark'].includes(world.mode);
  $('play').textContent=riding?(world.paused?'▷':'Ⅱ'):(world.auto?'Ⅱ':'▷');$('play').setAttribute('aria-label',riding?(world.paused?'继续乘船':'暂停乘船'):(world.auto?'停止自动行走':'自动行走'));
  $('left').disabled=$('right').disabled=world.mode!=='walk'||world.story.phase!=='idle';
  const story=world.story;$('story-panel').hidden=story.phase==='idle';$('story-progress').style.width=`${story.progress}%`;
  storyButton.textContent=story.phase==='lowering'?'按住落桅':story.phase==='towing'?'按住接绳 · 向左牵引':'查看画稿 ↗';
  $('story-message').textContent=story.phase==='lowering'?'漕船将至，按住按钮放下桅杆，避免撞上桥梁。':story.phase==='towing'?'桅杆已落。按住接绳，或按住左方向键，将船牵引过桥。':'漕船平安过桥。画师为你留下了一幅画稿。';
  $('memo').hidden=!sketchUrl;
  if(story.phase==='complete'&&previousStory!=='complete'){sketchUrl=renderer.sketch();$('memo').hidden=false;}
  previousStory=story.phase;
  $('scene').dataset.mode=world.mode;$('scene').dataset.story=story.phase;$('scene').dataset.playerX=world.x.toFixed(1);$('scene').dataset.paused=String(world.paused);$('scene').dataset.zoom=renderer.zoom.toFixed(2);
  $('scene').dataset.watercolor=String(renderer.people.ready);$('scene').dataset.umbrellas=String(renderer.umbrellaCount);$('scene').dataset.night=renderer.night.toFixed(2);$('scene').dataset.rain=renderer.rain.toFixed(2);
  $('scene').dataset.playerY=world.y.toFixed(1);$('scene').dataset.ferryPhase=world.ferry.phase;$('scene').dataset.ferryX=world.ferry.x.toFixed(1);$('scene').dataset.ferryY=world.ferry.y.toFixed(1);
  $('scene').dataset.effects=String(sound.effectsEnabled);$('scene').dataset.muted=String(sound.muted);$('scene').dataset.audioState=sound.ctx?.state??'locked';
  $('scene').dataset.activityStage=renderer.activityView?.stage??'';$('scene').dataset.birds=String(renderer.activityView?.birds??0);$('scene').dataset.grains=String(renderer.activityView?.grains??0);
}

function measureHotspots(){
  // Measure only on entry or a viewport change, while hidden from paint. This
  // avoids showing a label for one frame before learning its actual width.
  for(const h of hotspots){const wasHidden=h.el.hidden;h.el.style.visibility='hidden';h.el.hidden=false;h.halfWidth=h.el.offsetWidth/2;h.el.hidden=wasHidden;h.el.style.visibility='';}
}
function updateHotspots(now){
  // Anchor labels to the same camera frame as the painting. The slower status
  // update must not make moving labels jump across the scene every 100 ms.
  if(hotspotCamera!==null&&(Math.abs(renderer.camera-hotspotCamera)>.005||Math.abs(renderer.cameraY-hotspotCameraY)>.005))hotspotMotionUntil=now+160;
  hotspotCamera=renderer.camera;hotspotCameraY=renderer.cameraY;
  const moving=now<hotspotMotionUntil;
  if(moving!==hotspotsMoving){hotspotsMoving=moving;$('painting').classList.toggle('hotspots-moving',moving);}
  for(const h of hotspots){
    const board=h.id==='board';
    const allowed=board?canBoard():world.mode==='walk'&&world.story.phase==='idle';
    const p=renderer.point(board?world.ferry.from:h.x,board?world.ferry.y-35:h.y);
    const margin=Math.max(30,h.halfWidth+10),slack=h.onScreen?-12:12;
    const visible=allowed&&p.x>=margin+slack&&p.x<=renderer.width-margin-slack&&p.y>=80+slack&&p.y<=renderer.height-140-slack;
    h.onScreen=visible;
    if(h.el.hidden===visible)h.el.hidden=!visible;
    if(!visible)continue;
    const position=`translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0) translate(-50%,-100%)`;
    if(position!==h.position){h.position=position;h.el.style.transform=position;}
  }
}
function frame(now){
  const dt=clamp((now-last)/1000,0,.05);last=now;
  if(entered&&ready&&!document.hidden){
    const direction=(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
    world.update(dt,direction);
    if(rain&&world.time>rainUntil){rain=false;pressed('rain',false);toast('雨歇天青，水声依旧。');}
    renderer.render(dt,night?1:0,rain?1:0);sound.update(!world.paused,renderer.rain,night);
    updateHotspots(now);
    for(const event of world.events)toast(event);world.events.length=0;
    activityUI.update();
    uiClock+=dt;if(uiClock>.1){updateUI();uiClock=0;}
  }
  if(now>toastUntil)$('toast').classList.remove('visible');requestAnimationFrame(frame);
}
renderer.resize();requestAnimationFrame(frame);
