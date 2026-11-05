export const VIEW_W = 960;
export const VIEW_H = 540;
export const GROUND_Y = 440;
export const STEP = 1 / 120;
export const PHYSICS = { speed: 270, acceleration: 1850, friction: 2100, gravity: 1800, jump: 660 };

const layouts = [
  { name: 'Сонячна долина', width: 3520, checkpoint: 1840, sky: '#b9dec9', far: '#8abc99', near: '#609e79', turf: '#9cce66', soil: '#59724e', accent: '#f7d174', night: false,
    ground: [[0,720],[840,1560],[1680,2380],[2500,3520]],
    platforms: [[360,344,160],[1030,344,160],[1240,278,120],[1870,344,160],[2100,282,120],[2730,344,180]],
    blocks: [[240,320],[940,320],[1800,320],[2640,320]],
    enemies: [[580,500,670],[1350,1220,1500],[2160,2050,2300],[2940,2800,3100]] },
  { name: 'Грибний гай', width: 3840, checkpoint: 1680, sky: '#e9d7b4', far: '#bcb997', near: '#8da180', turf: '#b8c778', soil: '#806b52', accent: '#f2ba76', night: false,
    ground: [[0,640],[760,1370],[1510,2240],[2360,3020],[3160,3840]],
    platforms: [[320,344,160],[940,344,160],[1150,278,120],[1720,344,160],[1950,278,140],[2530,344,160],[2760,278,140],[3340,344,160]],
    blocks: [[220,320],[840,320],[1600,320],[2450,320],[3260,320]],
    enemies: [[500,390,580],[1210,1120,1300],[2050,1940,2170],[2790,2660,2940],[3480,3370,3610]] },
  { name: 'Нічні вогники', width: 4160, checkpoint: 1740, sky: '#263e50', far: '#34564f', near: '#3c7160', turf: '#8ebf7f', soil: '#415a4f', accent: '#e8d792', night: true,
    ground: [[0,680],[800,1460],[1580,2260],[2400,3080],[3220,4160]],
    platforms: [[350,344,160],[940,344,160],[1160,278,140],[1810,344,160],[2040,278,140],[2540,344,160],[2770,278,140],[3370,344,160],[3600,278,140]],
    blocks: [[230,320],[840,320],[1650,320],[2440,320],[3280,320]],
    enemies: [[530,430,610],[1290,1170,1390],[2040,1940,2180],[2850,2720,3010],[3540,3450,3640],[3880,3780,3980]] }
];

export const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const approach = (value, target, by) => value < target ? Math.min(target, value + by) : Math.max(target, value - by);

export function makeLevel(index) {
  const source = layouts[index];
  const solids = source.ground.map(([a,b]) => ({x:a,y:GROUND_Y,w:b-a,h:150,type:'ground'}));
  solids.push(...source.platforms.map(([x,y,w]) => ({x,y,w,h:20,type:'platform'})));
  solids.push(...source.blocks.map(([x,y]) => ({x,y,w:40,h:40,type:'block',used:false,bump:0})));
  const coins = [];
  for (const [a,b] of source.ground) for (let x=a+170;x<b-70;x+=100) coins.push({x,y:414,taken:false});
  for (const [x,y,w] of source.platforms) for (let dx=25;dx<w;dx+=45) coins.push({x:x+dx,y:y-24,taken:false});
  for (let i=0;i<source.ground.length-1;i++) {
    const a=source.ground[i][1],b=source.ground[i+1][0];
    coins.push({x:(a+b)/2,y:342,taken:false});
  }
  return {...source,solids,coins,goal:source.width-145,
    enemies:source.enemies.map(([x,min,max],i)=>({x,y:GROUND_Y-28,w:32,h:28,min,max,vx:(i%2?-1:1)*(43+index*9),alive:true}))};
}

export class Game {
  constructor() {
    this.state='ready';this.score=0;this.coinCount=0;this.lives=3;this.index=0;this.events=[];this.elapsed=0;this.viewportWidth=VIEW_W;
    this.loadLevel(0);
  }
  emit(type,x=this.player.x,y=this.player.y) { this.events.push({type,x,y}); }
  loadLevel(index) {
    this.index=index;this.level=makeLevel(index);this.checkpointActive=false;this.deathTimer=0;
    this.spawn(105);this.camera=0;
  }
  spawn(x) {
    this.player={x,y:GROUND_Y-34,w:26,h:34,vx:0,vy:0,facing:1,grounded:true,coyote:.11,jumpBuffer:0,invincible:0};
  }
  start() { this.score=0;this.coinCount=0;this.lives=3;this.elapsed=0;this.events=[];this.loadLevel(0);this.state='playing'; }
  next() { if(this.state==='levelclear'){this.loadLevel(this.index+1);this.state='playing';} }
  pause() { if(this.state==='playing') this.state='paused'; else if(this.state==='paused') this.state='playing'; }
  requestJump() { if(this.state==='playing') this.player.jumpBuffer=.14; }
  collect(coin) { if(coin.taken)return;coin.taken=true;this.coinCount++;this.score+=10;this.emit('coin',coin.x,coin.y); }
  die() {
    if(this.state!=='playing'||this.player.invincible>0)return;
    this.lives--;this.state='dying';this.deathTimer=.85;this.player.vy=-340;this.player.vx=0;this.emit('hurt');
  }
  step(dt,input={}) {
    const p=this.player,l=this.level;
    if(this.state==='dying') {
      this.deathTimer-=dt;p.vy+=PHYSICS.gravity*dt;p.y+=p.vy*dt;
      if(this.deathTimer<=0) {
        if(this.lives<=0){this.state='gameover';return;}
        this.spawn(this.checkpointActive?l.checkpoint:105);this.player.invincible=1.8;this.camera=Math.max(0,Math.min(l.width-this.viewportWidth,this.player.x-240));this.state='playing';this.emit('respawn');
      }
      return;
    }
    if(this.state!=='playing')return;
    this.elapsed+=dt;p.invincible=Math.max(0,p.invincible-dt);
    p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);p.coyote=p.grounded?.11:Math.max(0,p.coyote-dt);
    const direction=Number(!!input.right)-Number(!!input.left);
    p.vx=approach(p.vx,direction*PHYSICS.speed,(direction?PHYSICS.acceleration:PHYSICS.friction)*dt);
    if(direction)p.facing=direction;
    if(p.jumpBuffer>0&&p.coyote>0) {p.vy=-PHYSICS.jump;p.grounded=false;p.coyote=0;p.jumpBuffer=0;this.emit('jump');}
    if(!input.jump&&p.vy < -270)p.vy=-270;
    p.vy=Math.min(p.vy+PHYSICS.gravity*dt,900);
    const previousBottom=p.y+p.h;
    p.x+=p.vx*dt;p.x=Math.max(0,Math.min(l.width-p.w,p.x));
    for(const s of l.solids) if(intersects(p,s)) {if(p.vx>0)p.x=s.x-p.w;else if(p.vx<0)p.x=s.x+s.w;p.vx=0;}
    p.y+=p.vy*dt;p.grounded=false;
    for(const s of l.solids) {
      s.bump=Math.max(0,(s.bump||0)-dt);
      if(!intersects(p,s))continue;
      if(p.vy>0){p.y=s.y-p.h;p.grounded=true;p.coyote=.11;}
      else if(p.vy<0){p.y=s.y+s.h;if(s.type==='block'){s.bump=.18;if(!s.used){s.used=true;this.collect({x:s.x+20,y:s.y-17,taken:false});this.emit('bump',s.x+20,s.y);}}}
      p.vy=0;
    }
    for(const c of l.coins)if(!c.taken&&intersects(p,{x:c.x-10,y:c.y-12,w:20,h:24}))this.collect(c);
    for(const e of l.enemies) {
      if(!e.alive)continue;
      e.x+=e.vx*dt;
      if(e.x<e.min){e.x=e.min;e.vx=Math.abs(e.vx);}if(e.x>e.max){e.x=e.max;e.vx=-Math.abs(e.vx);}
      if(!intersects(p,e))continue;
      if(p.vy>=0&&previousBottom<=e.y+10){e.alive=false;p.y=e.y-p.h;p.vy=-410;this.score+=50;this.emit('stomp',e.x+16,e.y+12);}
      else this.die();
      if(this.state!=='playing')break;
    }
    if(this.state!=='playing')return;
    if(p.y>VIEW_H+70){p.invincible=0;this.die();return;}
    if(!this.checkpointActive&&p.x>=l.checkpoint){this.checkpointActive=true;this.emit('checkpoint',l.checkpoint,GROUND_Y-50);}
    if(p.x>=l.goal){this.score+=200;this.state=this.index===layouts.length-1?'won':'levelclear';this.emit('win',l.goal,GROUND_Y-130);}
    this.camera=approach(this.camera,Math.max(0,Math.min(l.width-this.viewportWidth,p.x-this.viewportWidth*.34)),650*dt);
  }
}
