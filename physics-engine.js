const { Engine, World, Bodies, Body } = Matter;

let engine, world, canvas, ctx;
let state = 'menu';
let cameraX = 0, cameraY = 0;
let player = null, platforms = [], enemies = [];
let bullets = []; // 纯逻辑子弹，脱离物理引擎
let playerImgObj = new Image(), enemyImgObj = new Image();
let currentConfig = null;
let keys = { left: false, right: false, up: false, shoot: false };
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
  player = null; platforms = []; enemies = []; bullets = [];
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

  platforms = []; enemies = []; bullets = [];
  cameraX = 0; cameraY = 0; shootTimer = 0; invincibleTimer = 0; lastTime = 0;

  // 生成地图平台
  (config.platforms || []).forEach(p => {
    let b = Bodies.rectangle(p.x + p.width/2, p.y + p.height/2, p.width, p.height, { isStatic: true, friction: 0 });
    World.add(world, b);
    platforms.push({ body: b, w: p.width, h: p.height });
  });

  // 生成主角
  const pc = config.player || { x: 100, y: 100, width: 40, height: 60, speed: 6, jump: -15, hp: 100 };
  let pBody = Bodies.rectangle(pc.x, pc.y, pc.width, pc.height, { friction: 0, frictionAir: 0.05, inertia: Infinity, label: 'player' });
  World.add(world, pBody);
  player = { body: pBody, w: pc.width, h: pc.height, speed: pc.speed, jump: pc.jump, hp: pc.hp, maxHp: pc.hp, facing: 1 };

  // 生成敌人
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

  if (player) {
    invincibleTimer -= dt;
    let vx = 0;
    if (keys.left) { vx -= player.speed; player.facing = -1; }
    if (keys.right) { vx += player.speed; player.facing = 1; }
    Body.setVelocity(player.body, { x: vx, y: player.body.velocity.y });

    // 射击逻辑（支持八方向）
    shootTimer -= dt;
    if (keys.shoot && shootTimer <= 0) {
      let bvx = 0, bvy = 0;
      const shootSpeed = 15;
      
      // 如果按了上键，垂直向上发射（也可以做斜向，这里为了手感直接做正交）
      if (keys.up) {
        bvy = -shootSpeed;
      } else {
        bvx = player.facing * shootSpeed;
      }

      bullets.push({
        x: player.body.position.x + (bvx > 0 ? 20 : bvx < 0 ? -20 : 0),
        y: player.body.position.y - 5,
        vx: bvx, vy: bvy, radius: 6, isEnemy: false
      });
      shootTimer = 0.15;
    }

    // 掉出地图
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

    if (en.behavior === 'chase') {
      Body.setVelocity(en.body, { x: Math.sign(dx) * en.speed, y: en.body.velocity.y });
    } else if (en.behavior === 'patrol') {
      if (en.body.position.x > en.originX + 100) en.speed = -Math.abs(en.speed);
      if (en.body.position.x < en.originX - 100) en.speed = Math.abs(en.speed);
      Body.setVelocity(en.body, { x: en.speed, y: en.body.velocity.y });
    } else if (en.behavior === 'fly_sine') {
      Body.setVelocity(en.body, { x: Math.sign(dx) * en.speed, y: Math.sin(now / 300) * 3 });
    }

    // 敌人攻击（远程子弹同样剥离物理引擎，防止下坠）
    if (en.attack === 'shoot' && dist < 600 && now - en.lastAttack > en.attackRate * 1000) {
      const angle = Math.atan2(dy, dx);
      bullets.push({
        x: en.body.position.x, y: en.body.position.y,
        vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8,
        radius: 5, isEnemy: true
      });
      en.lastAttack = now;
    } else if (en.attack === 'melee' && dist < 35 && invincibleTimer <= 0) {
      player.hp -= 15;
      invincibleTimer = 1.0;
      if(player.hp <= 0) gameOver(false);
    }
  });

  // 子弹碰撞检测（纯逻辑）
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    // 清理飞出视野的子弹（防止无限堆积）
    if (b.x < cameraX - 200 || b.x > cameraX + canvas.width + 200 || 
        b.y < cameraY - 200 || b.y > cameraY + canvas.height + 200) {
      bullets.splice(i, 1); continue;
    }

    let hit = false;
    if (b.isEnemy) {
      if (invincibleTimer <= 0 && Math.hypot(b.x - player.body.position.x, b.y - player.body.position.y) < 30) {
        player.hp -= 10;
        invincibleTimer = 1.0;
        hit = true;
        if(player.hp <= 0) { gameOver(false); return; }
      }
    } else {
      for (let j = enemies.length - 1; j >= 0; j--) {
        let en = enemies[j];
        if (Math.hypot(b.x - en.body.position.x, b.y - en.body.position.y) < 30) {
          en.hp -= 10;
          hit = true;
          if (en.hp <= 0) { World.remove(world, en.body); enemies.splice(j, 1); }
          break;
        }
      }
    }
    if (hit) bullets.splice(i, 1);
  }

  if (enemies.length === 0) { gameOver(true); return; }

  // 镜头跟随
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

  // 平台
  platforms.forEach(p => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(p.body.position.x - p.w/2, p.body.position.y - p.h/2, p.w, p.h);
    ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
    ctx.strokeRect(p.body.position.x - p.w/2, p.body.position.y - p.h/2, p.w, p.h);
  });

  // 玩家 (无敌闪烁)
  if (player) {
    if (!(invincibleTimer > 0 && Math.floor(now / 100) % 2 === 0)) {
      ctx.save(); ctx.translate(player.body.position.x, player.body.position.y);
      if (playerImgObj.complete && playerImgObj.naturalWidth > 0) {
        // 根据面朝方向翻转图片
        if (player.facing === -1) ctx.scale(-1, 1);
        ctx.drawImage(playerImgObj, -player.w/2, -player.h/2, player.w, player.h);
      } else {
        ctx.fillStyle = '#00ffff'; ctx.fillRect(-player.w/2, -player.h/2, player.w, player.h);
      }
      ctx.restore();
    }
  }

  // 敌人
  enemies.forEach(en => {
    ctx.save(); ctx.translate(en.body.position.x, en.body.position.y);
    if (enemyImgObj.complete && enemyImgObj.naturalWidth > 0) {
      ctx.drawImage(enemyImgObj, -en.w/2, -en.h/2, en.w, en.h);
    } else {
      ctx.fillStyle = '#ff0066'; ctx.fillRect(-en.w/2, -en.h/2, en.w, en.h);
    }
    ctx.restore();
  });

  // 子弹
  bullets.forEach(b => {
    ctx.fillStyle = b.isEnemy ? '#ff0000' : '#ffff00'; 
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill(); 
  });

  ctx.restore();

  // 固定在屏幕上的 UI
  drawHUD();

  requestAnimationFrame(loop);
}

function drawHUD() {
  if(!player) return;
  // 把血条移到左上角（hud 下方），避免被按钮遮挡
  const uiX = 20, uiY = 80;
  
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(uiX, uiY, 200, 20);
  ctx.fillStyle = player.hp > 30 ? '#00ffcc' : '#ff0000';
  ctx.fillRect(uiX, uiY, Math.max(0, 200 * (player.hp / player.maxHp)), 20);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(uiX, uiY, 200, 20);
  
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  ctx.fillText(`HP: ${Math.max(0, player.hp)}/${player.maxHp}`, uiX + 5, uiY + 15);
  ctx.fillText(`剩余敌人: ${enemies.length}`, uiX, uiY + 40);
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
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true; // 新增向上键判定
    if (e.code === 'Space') doJump();
    if (e.key === 'j' || e.key === 'J') keys.shoot = true;
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
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
  bind('btn-up', () => keys.up = true, () => keys.up = false); // 绑定新按钮
  bind('btn-jump', () => doJump());
  bind('btn-shoot', () => keys.shoot = true, () => keys.shoot = false);
}
