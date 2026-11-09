const { Engine, World, Bodies, Body } = Matter;

let engine, world, canvas, ctx;
let state = 'menu';
let cameraX = 0, cameraY = 0;
let player = null, platforms = [], enemies = [], bullets = [], enemyBullets = [];
let playerImgObj = new Image(), enemyImgObj = new Image();
let currentConfig = null;
let keys = { left: false, right: false, jump: false, shoot: false };
let shootTimer = 0;
let lastTime = 0;
let invincibleTimer = 0;

export function initEngine() {
  canvas = document.getElementById('canvas2d');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', () => {
    if (state === 'playing') {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
  bindControls();
}

export function stopGame() {
  state = 'menu';
  if (engine && world) World.clear(world, false);
  if (engine) Engine.clear(engine);
  player = null; platforms = []; enemies = []; bullets = []; enemyBullets = [];
}

export function runGame(config, pBase64, eBase64) {
  state = 'playing';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  engine = Engine.create();
  world = engine.world;
  currentConfig = config;
  engine.gravity.y = config.map?.gravity || 1;

  playerImgObj = new Image(); if (pBase64) playerImgObj.src = pBase64;
  enemyImgObj = new Image(); if (eBase64) enemyImgObj.src = eBase64;

  platforms = []; enemies = []; bullets = []; enemyBullets = [];
  cameraX = 0; cameraY = 0; shootTimer = 0; invincibleTimer = 0; lastTime = 0;

  // 1. 生成地图平台 (静态刚体)
  (config.platforms || []).forEach(p => {
    let b = Bodies.rectangle(p.x + p.width/2, p.y + p.height/2, p.width, p.height, { isStatic: true, friction: 0 });
    World.add(world, b);
    platforms.push({ body: b, w: p.width, h: p.height });
  });

  // 2. 生成主角
  const pc = config.player || { x: 100, y: 100, width: 40, height: 60, speed: 6, jump: -15, hp: 100 };
  let pBody = Bodies.rectangle(pc.x, pc.y, pc.width, pc.height, { friction: 0, frictionAir: 0.05, inertia: Infinity, label: 'player' });
  World.add(world, pBody);
  player = { body: pBody, w: pc.width, h: pc.height, speed: pc.speed, jump: pc.jump, hp: pc.hp, maxHp: pc.hp };

  // 3. 生成敌人
  (config.enemies || []).forEach(e => {
    let eBody = Bodies.rectangle(e.x, e.y, e.width, e.height, { friction: 0, frictionAir: 0.05, inertia: Infinity, label: 'enemy' });
    World.add(world, eBody);
    enemies.push({ 
      body: eBody, w: e.width, h: e.height, hp: e.hp, 
      behavior: e.behavior || 'patrol', speed: e.speed || 3, 
      attack: e.attack || 'melee', attackRate: e.attack_rate || 2,
      lastAttack: 0, originX: e.x 
    });
  });

  requestAnimationFrame(loop);
}

function doJump() {
  if (state !== 'playing' || !player) return;
  if (Math.abs(player.body.velocity.y) < 1) {
    Body.setVelocity(player.body, { x: player.body.velocity.x, y: player.jump });
  }
}

function loop(now) {
  if (state !== 'playing') return;
  if (!lastTime) lastTime = now;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // 玩家逻辑
  if (player) {
    invincibleTimer -= dt;
    let vx = 0;
    if (keys.left) vx -= player.speed;
    if (keys.right) vx += player.speed;
    Body.setVelocity(player.body, { x: vx, y: player.body.velocity.y });

    // 玩家射击
    shootTimer -= dt;
    if (keys.shoot && shootTimer <= 0) {
      let b = Bodies.circle(player.body.position.x + (vx >= 0 ? 20 : -20), player.body.position.y, 6, { label: 'bullet' });
      Body.setVelocity(b, { x: vx >= 0 ? 15 : -15, y: 0 });
      World.add(world, b);
      bullets.push(b);
      shootTimer = 0.2;
    }

    // 掉出地图扣血重置
    if (player.body.position.y > currentConfig.map.height + 200) {
      player.hp -= 10;
      if(player.hp <= 0) { gameOver(false); return; }
      Body.setPosition(player.body, { x: currentConfig.player.x, y: currentConfig.player.y });
      Body.setVelocity(player.body, { x: 0, y: 0 });
    }
  }

  // 敌人 AI 逻辑
  enemies.forEach(en => {
    if (!en.body) return;
    const dx = player.body.position.x - en.body.position.x;
    const dy = player.body.position.y - en.body.position.y;
    const dist = Math.hypot(dx, dy);

    // 移动行为
    if (en.behavior === 'chase') {
      Body.setVelocity(en.body, { x: Math.sign(dx) * en.speed, y: en.body.velocity.y });
    } else if (en.behavior === 'patrol') {
      // 在出生点左右 100 像素内巡逻
      if (en.body.position.x > en.originX + 100) en.speed = -Math.abs(en.speed);
      if (en.body.position.x < en.originX - 100) en.speed = Math.abs(en.speed);
      Body.setVelocity(en.body, { x: en.speed, y: en.body.velocity.y });
    } else if (en.behavior === 'fly_sine') {
      Body.setVelocity(en.body, { x: Math.sign(dx) * en.speed, y: Math.sin(now / 300) * 3 });
    }

    // 攻击行为
    if (en.attack === 'shoot' && dist < 600 && now - en.lastAttack > en.attackRate * 1000) {
      let eb = Bodies.circle(en.body.position.x, en.body.position.y, 5, { label: 'enemy_bullet' });
      const angle = Math.atan2(dy, dx);
      Body.setVelocity(eb, { x: Math.cos(angle) * 8, y: Math.sin(angle) * 8 });
      World.add(world, eb);
      enemyBullets.push(eb);
      en.lastAttack = now;
    } else if (en.attack === 'melee' && dist < 30 && invincibleTimer <= 0) {
      player.hp -= 15;
      invincibleTimer = 1.0; // 1秒无敌
      if(player.hp <= 0) gameOver(false);
    }
  });

  // 碰撞检测：玩家子弹打敌人
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    if (b.position.y > currentConfig.map.height + 500 || b.position.x > currentConfig.map.width + 500) {
      World.remove(world, b); bullets.splice(i, 1); continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      let en = enemies[j];
      if (Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y) < 30) {
        en.hp -= 10;
        World.remove(world, b); bullets.splice(i, 1);
        if (en.hp <= 0) {
          World.remove(world, en.body); enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // 碰撞检测：敌人子弹打玩家
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    let eb = enemyBullets[i];
    if (eb.position.y > currentConfig.map.height + 500 || eb.position.x > currentConfig.map.width + 500) {
      World.remove(world, eb); enemyBullets.splice(i, 1); continue;
    }
    if (invincibleTimer <= 0 && Math.hypot(eb.position.x - player.body.position.x, eb.position.y - player.body.position.y) < 30) {
      player.hp -= 10;
      invincibleTimer = 1.0;
      World.remove(world, eb); enemyBullets.splice(i, 1);
      if(player.hp <= 0) { gameOver(false); return; }
    }
  }

  // 胜利/失败结算
  if (enemies.length === 0) {
    gameOver(true); return;
  }

  // 镜头跟随 (平滑插值)
  let targetCamX = player.body.position.x - canvas.width / 2;
  let targetCamY = player.body.position.y - canvas.height / 2;
  targetCamX = Math.max(0, Math.min(targetCamX, currentConfig.map.width - canvas.width));
  targetCamY = Math.max(0, Math.min(targetCamY, currentConfig.map.height - canvas.height));
  cameraX += (targetCamX - cameraX) * 0.1;
  cameraY += (targetCamY - cameraY) * 0.1;

  // 渲染
  Engine.update(engine, dt * 1000);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  // 画平台
  platforms.forEach(p => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(p.body.position.x - p.w/2, p.body.position.y - p.h/2, p.w, p.h);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.body.position.x - p.w/2, p.body.position.y - p.h/2, p.w, p.h);
  });

  // 画玩家 (带无敌帧闪烁)
  if (player) {
    if (invincibleTimer > 0 && Math.floor(now / 100) % 2 === 0) {
      // 闪烁时不画
    } else {
      ctx.save();
      ctx.translate(player.body.position.x, player.body.position.y);
      if (playerImgObj.complete && playerImgObj.naturalWidth > 0) {
        ctx.drawImage(playerImgObj, -player.w/2, -player.h/2, player.w, player.h);
      } else {
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(-player.w/2, -player.h/2, player.w, player.h);
      }
      ctx.restore();
    }
  }

  // 画敌人
  enemies.forEach(en => {
    ctx.save();
    ctx.translate(en.body.position.x, en.body.position.y);
    if (enemyImgObj.complete && enemyImgObj.naturalWidth > 0) {
      ctx.drawImage(enemyImgObj, -en.w/2, -en.h/2, en.w, en.h);
    } else {
      ctx.fillStyle = '#ff0066';
      ctx.fillRect(-en.w/2, -en.h/2, en.w, en.h);
    }
    ctx.restore();
  });

  // 画子弹
  bullets.forEach(b => { ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI*2); ctx.fill(); });
  enemyBullets.forEach(b => { ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 5, 0, Math.PI*2); ctx.fill(); });

  ctx.restore();

  // 画固定在屏幕上的 UI (血条等)
  drawHUD();

  requestAnimationFrame(loop);
}

function drawHUD() {
  if(!player) return;
  // 血条背景
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(20, canvas.height - 50, 200, 20);
  // 当前血量
  ctx.fillStyle = player.hp > 30 ? '#00ffcc' : '#ff0000';
  ctx.fillRect(20, canvas.height - 50, Math.max(0, 200 * (player.hp / player.maxHp)), 20);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(20, canvas.height - 50, 200, 20);
  
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`HP: ${Math.max(0, player.hp)} / ${player.maxHp}`, 25, canvas.height - 55);
  ctx.fillText(`剩余敌人: ${enemies.length}`, 20, canvas.height - 70);
}

function gameOver(isWin) {
  state = 'menu';
  setTimeout(() => {
    alert(isWin ? '🎉 恭喜通关！' : '💀 你死了，游戏结束！');
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) exitBtn.click();
  }, 100);
}

function bindControls() {
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.code === 'Space' || e.key === 'ArrowUp') doJump();
    if (e.key === 'j' || e.key === 'J') keys.shoot = true;
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'j' || e.key === 'J') keys.shoot = false;
  });

  const bind = (id, down, up) => {
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); down(); });
    el.addEventListener('pointerup', e => { e.preventDefault(); if(up) up(); });
    el.addEventListener('pointerleave', e => { if(up) up(); });
  };
  bind('btn-left', () => keys.left = true, () => keys.left = false);
  bind('btn-right', () => keys.right = true, () => keys.right = false);
  bind('btn-jump', () => doJump());
  bind('btn-shoot', () => keys.shoot = true, () => keys.shoot = false);
}
