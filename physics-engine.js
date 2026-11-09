const { Engine, World, Bodies, Body } = Matter;

let engine = null, world = null;
let entities = [];
let bullets = [];
let state = 'menu';
let playerImgObj = new Image();
let enemyImgObj = new Image();
let keys = { left: false, right: false, shoot: false };
let canvas = null, ctx = null;
let shootTimer = 0;
let currentRules = {};
let cameraX = 0;
let lastTime = 0;
let groundBody = null;

export function initEngine() {
  canvas = document.getElementById('canvas2d');
  if (!canvas) throw new Error('找不到 #canvas2d');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', onResize);
  bindControls();
}

function onResize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (state === 'playing' && groundBody) {
    const floorY = canvas.height - 120;
    Body.setPosition(groundBody, { x: groundBody.position.x, y: floorY + 150 });
  }
}

export function stopGame() {
  state = 'menu';
  try {
    if (engine && world) World.clear(world, false);
    if (engine) Engine.clear(engine);
  } catch (e) { console.warn('清理引擎失败', e); }
  engine = null; world = null; groundBody = null;
  bullets = []; entities = [];
}

export function runGame(config, playerBase64, enemyBase64) {
  if (!canvas) canvas = document.getElementById('canvas2d');
  if (!canvas) { alert('画布丢失'); return; }
  if (!ctx) ctx = canvas.getContext('2d');

  state = 'playing';
  lastTime = 0;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  engine = Engine.create();
  world = engine.world;
  engine.gravity.y = 1;
  entities = []; bullets = [];
  cameraX = 0;
  shootTimer = 0;
  keys = { left: false, right: false, shoot: false };

  currentRules = (config && config.game_rules) || {};
  currentRules.player_speed = clamp(currentRules.player_speed || 6, 2, 20);
  currentRules.player_jump = clamp(currentRules.player_jump || -14, -22, -8);
  currentRules.enemy_hp = clamp(currentRules.enemy_hp || 30, 1, 9999);

  // 新图，避免旧图残留
  playerImgObj = new Image();
  enemyImgObj = new Image();
  if (playerBase64) playerImgObj.src = playerBase64;
  if (enemyBase64) enemyImgObj.src = enemyBase64;

  const floorY = canvas.height - 120;

  // 地面：20000 宽 × 300 厚，覆盖 -10000~10000，基本不可能掉出去
  groundBody = Bodies.rectangle(0, floorY + 150, 20000, 300, {
    isStatic: true,
    label: 'ground'
  });
  World.add(world, groundBody);
  entities.push({ type: 'ground', body: groundBody, w: 20000, h: 300 });

  // 玩家：底面正好贴地
  const playerBody = Bodies.rectangle(100, floorY - 30, 40, 60, {
    friction: 0,
    frictionAir: 0.05,
    restitution: 0,
    inertia: Infinity,
    label: 'player',
    collisionFilter: { group: -1 }   // 与敌人互不物理推挤
  });
  World.add(world, playerBody);
  entities.push({ type: 'player', body: playerBody, w: 40, h: 60 });

  // 敌人
  const enemyCount = Math.min(config?.user_enemyCount || 10, 50);
  const cols = 5;
  for (let i = 0; i < enemyCount; i++) {
    const ex = 400 + (i % cols) * 80;
    const ey = floorY - 21 - Math.floor(i / cols) * 60;
    const enemyBody = Bodies.rectangle(ex, ey, 40, 40, {
      friction: 0,
      inertia: Infinity,
      label: 'enemy',
      collisionFilter: { group: -1 } // 与玩家互不推挤
    });
    World.add(world, enemyBody);
    entities.push({ type: 'enemy', body: enemyBody, w: 40, h: 40, hp: currentRules.enemy_hp });
  }

  requestAnimationFrame(loop);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function doJump() {
  if (state !== 'playing') return;
  const p = entities.find(e => e.type === 'player');
  if (p && Math.abs(p.body.velocity.y) < 2) {
    Body.setVelocity(p.body, { x: p.body.velocity.x, y: currentRules.player_jump });
  }
}

function loop(now) {
  if (state !== 'playing') return;
  if (!engine || !world || !canvas || !ctx) { requestAnimationFrame(loop); return; }

  try {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const p = entities.find(e => e.type === 'player');
    const enemies = entities.filter(e => e.type === 'enemy');

    if (p) {
      // 掉出屏幕重置（双保险）
      const floorY = canvas.height - 120;
      if (p.body.position.y > canvas.height + 200 || p.body.position.x < -800) {
        Body.setPosition(p.body, { x: 100, y: floorY - 30 });
        Body.setVelocity(p.body, { x: 0, y: 0 });
      }

      let vx = 0;
      if (keys.left) vx = -currentRules.player_speed;
      if (keys.right) vx = currentRules.player_speed;
      Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

      const targetCamX = Math.max(0, p.body.position.x - canvas.width / 3);
      cameraX += (targetCamX - cameraX) * 0.1;

      shootTimer -= dt;
      if (keys.shoot && shootTimer <= 0) {
        const b = Bodies.circle(p.body.position.x + 20, p.body.position.y - 10, 8, {
          label: 'bullet',
          frictionAir: 0
        });
        Body.setVelocity(b, { x: 15, y: 0 });
        World.add(world, b);
        bullets.push(b);
        shootTimer = 0.15;
      }

      enemies.forEach(en => {
        if (!en.body) return;
        const dir = p.body.position.x > en.body.position.x ? 1 : -1;
        if (currentRules.enemy_behavior === 'fly') {
          Body.setVelocity(en.body, { x: dir * 3, y: Math.sin(now / 200) * 5 });
        } else {
          Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y });
        }
      });
    }

    // 子弹碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b || b.position.y > canvas.height + 500 || b.position.x > cameraX + canvas.width + 2000) {
        World.remove(world, b); bullets.splice(i, 1); continue;
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const en = enemies[j];
        if (!en.body) continue;
        if (Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y) < 40) {
          en.hp -= 10;
          World.remove(world, b); bullets.splice(i, 1);
          if (en.hp <= 0) {
            World.remove(world, en.body);
            const idx = entities.indexOf(en);
            if (idx >= 0) entities.splice(idx, 1);
          }
          break;
        }
      }
    }

    // HUD：只更新文本节点，不再重建 innerHTML
    const remaining = entities.filter(e => e.type === 'enemy').length;
    const enemyLbl = document.getElementById('hud-enemy');
    if (enemyLbl) enemyLbl.textContent = '敌人剩余: ' + remaining;

    if (remaining === 0) {
      state = 'menu';
      setTimeout(() => {
        alert('🎉 恭喜通关！');
        const exitBtn = document.getElementById('exit-btn');
        if (exitBtn) exitBtn.click();
      }, 50);
      return;
    }

    Engine.update(engine, dt * 1000);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, 0);

    entities.forEach(e => {
      if (!e.body) return;
      ctx.save();
      ctx.translate(e.body.position.x, e.body.position.y);

      if (e.type === 'player') {
        if (playerImgObj.complete && playerImgObj.naturalWidth > 0) {
          ctx.drawImage(playerImgObj, -e.w/2, -e.h/2, e.w, e.h);
        } else {
          ctx.fillStyle = '#00ffff';
          ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        }
      } else if (e.type === 'enemy') {
        if (enemyImgObj.complete && enemyImgObj.naturalWidth > 0) {
          ctx.drawImage(enemyImgObj, -e.w/2, -e.h/2, e.w, e.h);
        } else {
          ctx.fillStyle = '#ff0066';
          ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        }
      } else {
        ctx.fillStyle = '#0a1a2e';
        ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
      }
      ctx.restore();
    });

    bullets.forEach(b => {
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  } catch (e) {
    console.error('loop error', e);
  }

  requestAnimationFrame(loop);
}

function bindControls() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.code === 'Space' || e.key === 'ArrowUp') doJump();
    if (e.key === 'j' || e.key === 'J') keys.shoot = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'j' || e.key === 'J') keys.shoot = false;
  });

  const bL = document.getElementById('btn-left');
  const bR = document.getElementById('btn-right');
  const bJ = document.getElementById('btn-jump');
  const bS = document.getElementById('btn-shoot');

  const bindHold = (el, onDown, onUp) => {
    if (!el) return;
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { e.preventDefault(); onUp && onUp(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  };

  bindHold(bL, () => keys.left = true, () => keys.left = false);
  bindHold(bR, () => keys.right = true, () => keys.right = false);
  bindHold(bJ, () => doJump(), null);
  bindHold(bS, () => keys.shoot = true, () => keys.shoot = false);
}
