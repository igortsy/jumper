import {Game, STEP, GROUND_Y} from './engine.js';

const $ = id => document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d'),game=new Game();
const held=new Set(),particles=[];
let best=0,soundOn=false,audioContext,lastHud='',lastState='',clock=0,toastTimer;
try{best=Math.max(0,Number(localStorage.getItem('leafbound.best'))||0);soundOn=localStorage.getItem('leafbound.sound')==='on';}catch{}
$('best').textContent=String(best).padStart(4,'0');

function updateSoundButton(){ $('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'Вимкнути звук':'Увімкнути звук'); }
updateSoundButton();
function audioReady(){if(!soundOn)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function tone(notes,type='triangle',volume=.06){
  if(!soundOn||!audioContext)return;
  const now=audioContext.currentTime;
  notes.forEach(([freq,start,duration])=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now+start);gain.gain.setValueAtTime(0,now+start);gain.gain.linearRampToValueAtTime(volume,now+start+.008);gain.gain.exponentialRampToValueAtTime(.001,now+start+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now+start);osc.stop(now+start+duration+.02);});
}
function sound(type){
  if(type==='jump')tone([[280,0,.08],[410,.045,.12]],'sine',.035);
  if(type==='coin')tone([[880,0,.06],[1320,.06,.13]]);
  if(type==='stomp')tone([[170,0,.08],[100,.05,.12]],'square',.025);
  if(type==='hurt')tone([[220,0,.12],[165,.12,.12],[110,.24,.25]]);
  if(type==='checkpoint')tone([[523,0,.1],[659,.09,.1],[784,.18,.2]]);
  if(type==='win')tone([[523,0,.12],[659,.12,.12],[784,.24,.12],[1046,.36,.35]]);
}
$('sound').addEventListener('click',()=>{soundOn=!soundOn;updateSoundButton();try{localStorage.setItem('leafbound.sound',soundOn?'on':'off');}catch{}audioReady();if(soundOn)tone([[660,0,.1]]);});

function clearInput(){held.clear();document.querySelectorAll('.touch-button').forEach(el=>el.classList.remove('pressed'));}
function activate(){clearInput();audioReady();if(game.state==='paused')game.pause();else if(game.state==='levelclear')game.next();else game.start();canvas.focus({preventScroll:true});syncHud();}
$('play').addEventListener('click',activate);
function pause(){if(game.state==='playing'||game.state==='paused'){game.pause();clearInput();syncHud();}}
$('pause').addEventListener('click',pause);
$('restart').addEventListener('click',()=>{game.start();clearInput();audioReady();canvas.focus({preventScroll:true});syncHud();});
const jumpKeys=new Set(['Space','ArrowUp','KeyW']);
const keyAliases={arrowleft:'ArrowLeft',arrowright:'ArrowRight',arrowup:'ArrowUp',' ':'Space',a:'KeyA',d:'KeyD',w:'KeyW',p:'KeyP',r:'KeyR',escape:'Escape',enter:'Enter'};
const keyCode=e=>keyAliases[String(e.key).toLowerCase()]||e.code;
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement)return;
  const controlled=['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','KeyP','Escape','KeyR','Enter'];
  const code=keyCode(e);
  if(!controlled.includes(code))return;
  if(e.target instanceof HTMLButtonElement&&(code==='Space'||code==='Enter'))return;
  e.preventDefault();
  if(code==='KeyP'||code==='Escape'){if(!e.repeat)pause();return;}
  if(code==='KeyR'){if(!e.repeat){game.start();clearInput();audioReady();canvas.focus({preventScroll:true});syncHud();}return;}
  if((code==='Enter'||code==='Space')&&['ready','paused','levelclear','gameover','won'].includes(game.state)){if(!e.repeat)activate();return;}
  held.add(code);if(jumpKeys.has(code)&&!e.repeat)game.requestJump();
});
document.addEventListener('keyup',e=>held.delete(keyCode(e)));
window.addEventListener('blur',()=>{clearInput();if(game.state==='playing'){game.pause();syncHud();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game.state==='playing'){game.pause();syncHud();}}});
for(const [id,key] of [['left','ArrowLeft'],['right','ArrowRight'],['jump','Space']]){
  const el=$(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);held.add(key);el.classList.add('pressed');audioReady();if(id==='jump')game.requestJump();});
  const release=()=>{held.delete(key);el.classList.remove('pressed');};
  el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}

function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400);$('announcement').textContent=text;}
function syncHud(){
  const stamp=[game.index,game.coinCount,game.score,game.lives,game.state].join('/');if(stamp===lastHud)return;lastHud=stamp;
  $('world').innerHTML=String(game.index+1).padStart(2,'0')+' <small>/ 03</small>';
  $('coins').textContent=String(game.coinCount).padStart(2,'0');$('score').textContent=String(game.score).padStart(4,'0');
  $('hearts').innerHTML=Array.from({length:3},(_,i)=>i<game.lives?'♥':'<span class="lost">♥</span>').join(' ');
  $('hearts').setAttribute('aria-label',`Залишилося життів: ${game.lives}`);
  $('world-tag').innerHTML='<i></i> '+game.level.name.toUpperCase();
  document.querySelectorAll('.world-dots i').forEach((el,i)=>el.classList.toggle('active',i<=game.index));
  $('pause').disabled=!['playing','paused'].includes(game.state);
  $('pause').setAttribute('aria-label',game.state==='paused'?'Продовжити':'Пауза');
  $('pause').innerHTML=game.state==='paused'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  if(game.score>best){best=game.score;$('best').textContent=String(best).padStart(4,'0');try{localStorage.setItem('leafbound.best',String(best));}catch{}}
  const overlays={
    ready:['ТВОЯ ПРИГОДА ПОЧИНАЄТЬСЯ ТУТ','Менше думай.<br><em>Вище стрибай.</em>','Збирай монети, перестрибуй прірви та дістанься прапорця. Попереду — три маленькі світи.','Почати пригоду'],
    paused:['ВИДИХНИ. ПРИГОДА ЗАЧЕКАЄ.','Маленька<br><em>перерва.</em>','Твої монети й пройдений шлях на місці. Повертайся, коли будеш готовий.','Продовжити'],
    levelclear:['ПРАПОРЕЦЬ ТВОЇЙ НАПОЛЕГЛИВОСТІ','Світ пройдено.<br><em>Рушаємо далі?</em>',`Ти пройшов світ «${game.level.name}». Монет: ${game.coinCount}. Очок: ${game.score}. Попереду нова пригода!`,'Наступний світ'],
    gameover:['КОЖНА СПРОБА — НОВА ІСТОРІЯ','Ще один<br><em>маленький шанс.</em>',`Цього разу: ${game.coinCount} монет і ${game.score} очок. Спробуй знову — тепер ти знаєш дорогу.`,'Спробувати ще'],
    won:['УСІ ТРИ СВІТИ ПІДКОРЕНО','Оце так<br><em>пригодницький дух!</em>',`Фініш! Ти зібрав ${game.coinCount} монет і набрав ${game.score} очок. Можливо, наступного разу знайдеш ще більше?`,'Нова пригода']
  };
  const content=overlays[game.state];$('overlay').hidden=!content;
  if(content){$('overlay-kicker').textContent=content[0];$('overlay-title').innerHTML=content[1];$('overlay-text').textContent=content[2];$('play-label').textContent=content[3];}
  const statuses={ready:'Готовий до пригоди?',playing:'Лови монети. Шукай прапорець.',paused:'Гра на паузі',dying:'Не здавайся — ще один стрибок!',levelclear:'Світ пройдено · +200 очок',gameover:'Кінець гри · спробуй ще',won:'Пригоду завершено. Ти молодець!'};
  $('game-status').textContent=statuses[game.state];
  if(lastState!==game.state){if(content&&game.state!=='ready')$('announcement').textContent=content[2];lastState=game.state;}
}

function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
function hash(n){return Math.abs(Math.sin(n*127.1+311.7)*43758.5453)%1;}
function cloud(x,y,s,night){const c=night?'#99bfb51c':'#f5fae6a8';rect(x,y+8*s,72*s,13*s,c);rect(x+13*s,y,39*s,26*s,c);rect(x+25*s,y-6*s,18*s,10*s,c);}
function hillLayer(color,base,amplitude,step,factor){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,540);for(let x=-step;x<=canvas.width+step;x+=step){const wx=x+game.camera*factor;const y=base+Math.sin(wx/175)*amplitude+Math.cos(wx/89)*amplitude*.35;ctx.lineTo(x,y);ctx.lineTo(x+step,y);}ctx.lineTo(canvas.width+step,540);ctx.closePath();ctx.fill();}
function background(){
  const l=game.level,w=canvas.width,grad=ctx.createLinearGradient(0,0,0,540);grad.addColorStop(0,l.sky);grad.addColorStop(1,l.night?'#80a88a':'#d9e8ba');ctx.fillStyle=grad;ctx.fillRect(0,0,w,540);
  const sx=w-140-game.camera*.025,sy=98;
  ctx.fillStyle=l.night?'#dfedbb':'#f6e4a0';ctx.beginPath();ctx.arc(sx,sy,35,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=l.night?'#dbeab413':'#fff4c33b';ctx.lineWidth=16;ctx.beginPath();ctx.arc(sx,sy,49,0,Math.PI*2);ctx.stroke();
  if(l.night){ctx.fillStyle=l.sky;ctx.beginPath();ctx.arc(sx+14,sy-10,31,0,Math.PI*2);ctx.fill();for(let i=0;i<35;i++){const a=hash(i+1),b=hash(i+120);rect((a*(w+100)-game.camera*.03+w+100)%(w+100),b*250,2+(i%2),2,l.accent);}}
  for(let i=-1;i<7;i++)cloud(i*250+80-(game.camera*.12+clock*2)%250,73+(i%3)*39,.7+(i%2)*.3,l.night);
  hillLayer(l.far,313,52,38,.18);hillLayer(l.near,382,53,26,.36);
  for(let i=Math.floor(game.camera*.45/190)-1;i<(game.camera*.45+w)/190+1;i++){
    const x=i*190-game.camera*.45,y=278+hash(i+70)*64;rect(x+32,y+25,13,145,l.night?'#305f51':'#679573');
    const color=l.night?'#386c57':'#81b185';rect(x,y+25,75,66,color);rect(x+13,y+7,51,83,color);rect(x+26,y-8,26,103,color);
  }
  const haze=ctx.createLinearGradient(0,350,0,540);haze.addColorStop(0,'#123d2100');haze.addColorStop(1,l.night?'#142e34':'#4b876c');ctx.fillStyle=haze;ctx.fillRect(0,350,w,190);
}
function tree(x,y,variant){
  const night=game.level.night;rect(x-7,y-153,17,153,night?'#4d6b54':'#69815b');rect(x+3,y-148,4,140,night?'#385b4a':'#526b4c');
  rect(x+7,y-111,26,9,night?'#4d6b54':'#69815b');rect(x+27,y-133,8,31,night?'#4d6b54':'#69815b');
  const dark=night?'#477952':'#75a958',light=night?'#689964':'#96bf6c';
  rect(x-62,y-195,116,66,dark);rect(x-44,y-222,84,115,dark);rect(x-21,y-238,48,140,dark);
  rect(x-44,y-214,65,21,light);rect(x-59,y-184,45,15,light);rect(x+17,y-180,38,18,light);rect(x-22,y-232,27,14,light);
  if(variant%2){rect(x+27,y-147,10,9,game.level.accent);rect(x-35,y-169,8,9,game.level.accent);}
}
function mushroom(x,y,size=1){const s=size;rect(x-3*s,y-18*s,6*s,18*s,'#e4d9b0');rect(x-16*s,y-25*s,32*s,10*s,'#c98463');rect(x-11*s,y-32*s,22*s,17*s,'#d99b6e');rect(x-5*s,y-34*s,10*s,5*s,'#d99b6e');rect(x-9*s,y-28*s,5*s,4*s,'#efd5a0');rect(x+5*s,y-24*s,5*s,4*s,'#efd5a0');}
function decorations(){
  for(const [a,b] of game.level.ground){
    for(let x=a+180;x<b-70;x+=330){const screen=x-game.camera;if(screen<-120||screen>canvas.width+120)continue;if(game.index===1)mushroom(screen,GROUND_Y,2.1+(Math.round(x)%3)*.2);else tree(screen,GROUND_Y,Math.round(x));}
  }
  for(let i=Math.floor(game.camera/58);i<(game.camera+canvas.width)/58+1;i++){
    const x=i*58+hash(i)*24;if(!game.level.ground.some(([a,b])=>x>a+10&&x<b-10))continue;const sx=x-game.camera;
    rect(sx,GROUND_Y-9,3,9,'#8db260');rect(sx+3,GROUND_Y-13,3,8,'#accb78');
    if(i%3===0){rect(sx-3,GROUND_Y-12,4,4,game.level.accent);rect(sx-1,GROUND_Y-14,2,2,'#f6efc4');}
    if(i%7===0)mushroom(sx+16,GROUND_Y,.6);
  }
  if(game.level.night)for(let i=0;i<18;i++){const x=((i*183-game.camera*.7)%(canvas.width+100)+canvas.width+100)%(canvas.width+100)-50;const y=230+Math.sin(clock*.8+i*2)*60;ctx.globalAlpha=.3+Math.sin(clock*2+i)*.25;rect(x,y,3,3,'#e9eda2');ctx.globalAlpha=1;}
}
function solid(s){
  const x=Math.round(s.x-game.camera);if(x+s.w<0||x>canvas.width)return;const l=game.level;
  if(s.type==='block'){
    const y=s.y-Math.sin((s.bump||0)/.18*Math.PI)*7;
    rect(x,y,40,40,s.used?'#758269':'#b97d40');rect(x+3,y+3,34,32,s.used?'#8b9675':'#e4b15d');rect(x+3,y+3,34,4,s.used?'#a0ab87':'#f4d18a');rect(x+3,y+34,34,3,s.used?'#64755d':'#9e6c36');
    if(!s.used){ctx.fillStyle='#fff1ba';ctx.font='bold 26px monospace';ctx.textAlign='center';ctx.fillText('?',x+20,y+29);}else{rect(x+18,y+18,4,4,'#617459');}return;
  }
  rect(x,s.y,s.w,s.h,l.soil);rect(x,s.y,s.w,8,l.turf);rect(x,s.y+8,s.w,6,l.night?'#60895f':'#74974e');
  for(let tx=Math.floor(Math.max(0,game.camera-s.x)/40)*40;tx<s.w&&x+tx<canvas.width;tx+=40){
    rect(x+tx+2,s.y+1,15,3,l.night?'#b1d393':'#c0df8c');rect(x+tx+20,s.y+8,7,5,l.turf);
    if(s.type==='ground')for(let row=0;row<4;row++){const px=x+tx+Math.floor(hash((s.x+tx)/40+row*30)*26);rect(px,s.y+26+row*26,7,4,l.night?'#53715b':'#71855a');rect(px+15,s.y+20+row*26,3,6,l.night?'#354e45':'#475f44');}
    else{rect(x+tx+6,s.y+15,14,3,l.night?'#344d43':'#405e43');}
  }
}
function coin(c){if(c.taken)return;const x=c.x-game.camera;if(x<-20||x>canvas.width+20)return;const y=c.y+Math.sin(clock*3+c.x)*2;const w=5+Math.abs(Math.sin(clock*3+c.x*.02))*9;rect(x-w/2-2,y-11,w+4,22,'#a77434');rect(x-w/2,y-12,w,20,'#f6ce70');rect(x-w/2+1,y-10,Math.max(2,w*.32),15,'#fff0aa');rect(x+w/2-3,y-6,2,9,'#d49a43');}
function enemy(e){
  if(!e.alive)return;const x=Math.round(e.x-game.camera),y=e.y;if(x<-50||x>canvas.width+50)return;
  const walk=Math.sin(clock*10+e.x*.1)>0?2:0;
  rect(x+2,y+23,29,4,'#21483255');rect(x+2,y+19+walk,9,7-walk,'#344f39');rect(x+22,y+19-walk,8,7+walk,'#344f39');
  rect(x+4,y+9,25,14,'#e5c891');rect(x+1,y+7,31,9,'#bd7857');rect(x+5,y+2,24,12,'#d89165');rect(x+11,y,12,10,'#e6a775');
  rect(x+8,y+5,5,4,'#f4d39b');rect(x+21,y+8,4,3,'#f4d39b');rect(x+9,y+16,3,4,'#2c4032');rect(x+23,y+16,3,4,'#2c4032');
}
function player(){
  const p=game.player;if(p.invincible>0&&Math.floor(p.invincible*12)%2===0)return;
  const walk=p.grounded&&Math.abs(p.vx)>15?Math.sin(clock*18)*2:0;
  ctx.save();ctx.translate(Math.round(p.x-game.camera+p.w/2),Math.round(p.y));ctx.scale(p.facing,1);
  if(p.grounded){ctx.fillStyle='#21412d3b';ctx.beginPath();ctx.ellipse(0,35,18,4,0,0,Math.PI*2);ctx.fill();}
  rect(-11,18,8,13,'#3b665a');rect(-13,20,5,9,'#659481');
  rect(-8,1,17,7,'#d17b42');rect(-5,-2,11,5,'#e89a50');rect(-8,7,18,12,'#f0cc98');rect(-9,7,5,8,'#735d40');rect(7,10,4,5,'#f0cc98');rect(4,8,3,4,'#294437');
  rect(-8,18,17,10,'#e09a56');rect(-6,17,13,3,'#f6c578');rect(5,20+walk,6,8,'#e8aa65');rect(7,26+walk,4,4,'#f0cc98');rect(-9,23-walk,5,7,'#db9354');
  rect(-7,27,7,6+walk,'#3b5b50');rect(2,27,6,6-walk,'#3b5b50');rect(-9,31+walk,9,4,'#28453d');rect(2,31-walk,10,4,'#28453d');
  rect(-5,16,11,3,'#769a68');rect(-9,16,5,6,'#a8c482');ctx.restore();
}
function flag(x,active,isGoal=false){const sx=x-game.camera;if(sx<-60||sx>canvas.width+60)return;const h=isGoal?176:70,y=GROUND_Y-h;rect(sx,y,5,h,'#e1d7a9');rect(sx-3,y-6,11,8,'#f4dc93');const color=active?'#c7ed8c':'#819c79';rect(sx+5,y+5,isGoal?49:32,isGoal?32:22,color);rect(sx+34,y+5,12,8,color);rect(sx+33,y+27,15,10,color);if(isGoal){rect(sx+17,y+12,4,17,'#5f8853');rect(sx+11,y+18,16,4,'#5f8853');}rect(sx-10,GROUND_Y-4,26,5,'#8ba36a');}
function finishHouse(){const x=game.level.width-100-game.camera,y=GROUND_Y;if(x>canvas.width+50||x<-100)return;rect(x-26,y-64,69,64,'#d3bd8d');rect(x-33,y-75,82,14,'#526f51');rect(x-22,y-86,60,14,'#6c8a5b');rect(x-7,y-96,32,14,'#8eaa65');rect(x-6,y-40,22,40,'#58715b');rect(x+25,y-45,12,15,'#efdfa2');rect(x+4,y-23,3,4,'#d6c28b');}
function burst(x,y,color,count=8){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*180,vy:-70-Math.random()*180,life:.5+Math.random()*.3,max:1,color,size:3+Math.random()*3});}
function processEvents(){for(const e of game.events.splice(0)){sound(e.type);if(e.type==='coin')burst(e.x,e.y,'#ffdf83',5);if(e.type==='stomp')burst(e.x,e.y,'#e4b584',12);if(e.type==='hurt')burst(e.x+13,e.y+15,'#e9a46f',15);if(e.type==='checkpoint'){burst(e.x,e.y,'#d8f6a4',16);toast('✦ Контрольна точка! Тут можна відродитися.');}if(e.type==='win')burst(e.x,e.y,'#f1df91',36);if(e.type==='respawn')toast(game.checkpointActive?'Повертаємось до контрольної точки':'Ще одна спроба. У тебе вийде!');}}
function render(){
  ctx.imageSmoothingEnabled=false;background();decorations();finishHouse();flag(game.level.checkpoint,game.checkpointActive);flag(game.level.goal,true,true);
  for(const s of game.level.solids)solid(s);for(const c of game.level.coins)coin(c);for(const e of game.level.enemies)enemy(e);player();
  for(const p of particles){ctx.globalAlpha=Math.max(0,Math.min(1,p.life*2));rect(p.x-game.camera,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
}
new ResizeObserver(entries=>{const r=entries[0].contentRect;const width=Math.round(540*r.width/r.height);if(width>0&&canvas.width!==width){canvas.width=width;game.viewportWidth=width;}}).observe($('stage'));
let previous=performance.now(),accumulator=0;
function frame(now){
  const delta=Math.min((now-previous)/1000,.06);previous=now;clock+=delta;accumulator+=delta;
  const input={left:held.has('ArrowLeft')||held.has('KeyA'),right:held.has('ArrowRight')||held.has('KeyD'),jump:held.has('Space')||held.has('ArrowUp')||held.has('KeyW')};
  while(accumulator>=STEP){game.step(STEP,input);accumulator-=STEP;}
  processEvents();
  if(game.state!=='paused')for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=450*delta;if(p.life<=0)particles.splice(i,1);}
  syncHud();render();requestAnimationFrame(frame);
}
syncHud();requestAnimationFrame(frame);
