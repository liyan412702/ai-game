const { Engine, World, Bodies, Body } = Matter;

let engine, world;
let entities = []; 
let bullets = []; 
let state = 'menu';
let keys = { left: false, right: false, shoot: false };
let canvas, ctx;
let shootTimer = 0;
let camX = 0;
let theme = 'cyber';

const THEME_COLORS = {
    cyber: { player: '#00ffff', enemy: '#ff0066', platform: '#4ea1ff', coin: '#ffcc00', bg: '#0a0a1a' },
    forest: { player: '#00ff66', enemy: '#ff3300', platform: '#006622', coin: '#ffff00', bg: '#051005' },
    space: { player: '#ffffff', enemy: '#ff00ff', platform: '#333344', coin: '#00ffff', bg: '#000000' }
};

export function initEngine() {
    canvas = document.getElementById('canvas2d');
    ctx = canvas.getContext('2d');
    canvas.width = innerWidth; canvas.height = innerHeight;
    window.world = null;
    window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeight; });
    bindControls();
}

export function stopGame() {
    state = 'menu';
    if (engine) { Engine.clear(engine); World.clear(world); }
    bullets = []; entities = [];
}

export function runGame(config) {
    state = 'playing';
    engine = Engine.create();
    world = engine.world;
    window.world = world;
    theme = config.theme || 'cyber';
    if(!THEME_COLORS[theme]) theme = 'cyber';
    
    engine.gravity.y = config.gravity || 1; 
    document.getElementById('game-bg').style.background = THEME_COLORS[theme].bg;
    
    entities = []; bullets = [];
    camX = 0;

    // 🌟 核心修复：获取当前屏幕的绝对底部
    const floorY = canvas.height - 50;

    // 🌟 核心修复 1：管 AI 给没给地面，我们强制在屏幕底部铺一层“隐形保护网”
    let secureGround = Bodies.rectangle(canvas.width / 2, floorY + 30, canvas.width * 3, 60, { isStatic: true });
    World.add(world, secureGround);
    entities.push({ type: 'platform', body: secureGround, w: canvas.width * 3, h: 60, color: THEME_COLORS[theme].platform });

    let playerSpawned = false;
    let enemySpawnCount = 0;

    // 🌟 核心修复 2：强制纠正 AI 给的出生点
    config.entities.forEach(e => {
        let body;
        let color = THEME_COLORS[theme].platform;
        
        if (e.type === 'player') color = THEME_COLORS[theme].player;
        if (e.type.includes('enemy')) color = THEME_COLORS[theme].enemy;
        if (e.type === 'coin') color = THEME_COLORS[theme].coin;

        // 如果 AI 生成了地面，我们画出来当装饰，但不参与物理（因为有保护网了）
        if (e.type === 'platform') {
            // 防止 AI 给的地面太低，强制拉到屏幕内
            let safeY = Math.min(e.y, floorY); 
            body = Bodies.rectangle(e.x, safeY, e.w, e.h, { isStatic: true });
        }
        else if (e.type === 'coin') {
            let safeY = Math.min(e.y, floorY - 50);
            body = Bodies.circle(e.x, safeY, e.w/2, { isStatic: true, isSensor: true });
        }
        else if (e.type === 'player') {
            if (!playerSpawned) {
                // 无视 AI 坐标，主角强制出生在左侧半空
                body = Bodies.rectangle(100, floorY - 100, 40, 60, { friction: 0, frictionAir: 0.05, inertia: Infinity });
                playerSpawned = true;
            }
        }
        else if (e.type.includes('enemy')) {
            // 无视 AI 坐标，怪物强制依次出生在右侧半空
            let ex = canvas.width - 100 - (enemySpawnCount * 60);
            let ey = floorY - 100 - (Math.random() * 50);
            body = Bodies.rectangle(ex, ey, 40, 40, { friction: 0, inertia: Infinity });
            enemySpawnCount++;
        }
        else {
            let safeY = Math.min(e.y, floorY - 20);
            body = Bodies.rectangle(e.x, safeY, e.w, e.h, { friction: 0, inertia: Infinity });
        }

        if (body) {
            World.add(world, body);
            entities.push({ type: e.type, body: body, w: e.w, h: e.h, color: color, hp: 30 });
        }
    });

    // 如果 AI 忘了给主角，我们强制补一个
    if (!playerSpawned) {
        let pBody = Bodies.rectangle(100, floorY - 100, 40, 60, { friction: 0, frictionAir: 0.05, inertia: Infinity });
        World.add(world, pBody);
        entities.push({ type: 'player', body: pBody, w: 40, h: 60, color: THEME_COLORS[theme].player });
    }

    // 如果 AI 忘了给怪物（或者给的怪物被过滤了），根据用户要求的数量补齐
    let userReqEnemies = config.user_enemyCount || 10;
    while (enemySpawnCount < userReqEnemies) {
        let ex = canvas.width - 100 - (enemySpawnCount * 60) % (canvas.width - 200);
        let ey = floorY - 100 - (Math.random() * 50);
        let eBody = Bodies.rectangle(ex, ey, 40, 40, { friction: 0, inertia: Infinity });
        World.add(world, eBody);
        entities.push({ type: 'enemy_chase', body: eBody, w: 40, h: 40, color: THEME_COLORS[theme].enemy, hp: 30 });
        enemySpawnCount++;
    }

    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function doJump() {
    const p = entities.find(e => e.type === 'player');
    if (p && Math.abs(p.body.velocity.y) < 2) Body.setVelocity(p.body, { x: p.body.velocity.x, y: -14 });
}

let lastTime = 0;
function loop(now) {
    if (state !== 'playing') return;
    try {
        const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
        
        const p = entities.find(e => e.type === 'player');
        const enemies = entities.filter(e => e.type.includes('enemy'));

        if (p) {
            let vx = 0;
            if (keys.left) vx = -6;
            if (keys.right) vx = 6;
            Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

            shootTimer -= dt;
            if (keys.shoot && shootTimer <= 0) {
                let b = Bodies.circle(p.body.position.x, p.body.position.y, 6, { isStatic: false, isSensor: true });
                Body.setVelocity(b, { x: 15, y: 0 }); 
                World.add(world, b); bullets.push(b);
                shootTimer = 0.15;
            }

            enemies.forEach(en => {
                let dir = p.body.position.x > en.body.position.x ? 1 : -1;
                if (en.type === 'enemy_fly') {
                    Body.setVelocity(en.body, { x: dir * 3, y: Math.sin(now / 200) * 4 }); 
                } else {
                    Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y }); 
                }
            });
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            for (let j = enemies.length - 1; j >= 0; j--) {
                let en = enemies[j];
                if (Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y) < 40) {
                    en.hp -= 10;
                    World.remove(world, b); bullets.splice(i, 1);
                    if (en.hp <= 0) { World.remove(world, en.body); entities.splice(entities.indexOf(en), 1); }
                    break;
                }
            }
        }

        if (enemies.length === 0) {
            state = 'menu';
            alert('🎉 世界已被净化！通关！');
            const exitBtn = document.getElementById('exit-btn');
            if(exitBtn) exitBtn.click();
            return;
        }

        let hud = document.getElementById('hud');
        if(hud) {
            let titleEl = document.getElementById('hud-title');
            let titleStr = titleEl ? titleEl.textContent : '游戏';
            hud.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">${titleStr}</div><div style="color:${THEME_COLORS[theme].player};">敌人剩余: ${enemies.length}</div>`;
        }

        Engine.update(engine, dt * 1000);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 相机居中跟随
        if (p && p.body.position.x > canvas.width / 2) camX = p.body.position.x - canvas.width / 2;
        else camX = 0;

        ctx.save();
        ctx.translate(-camX, 0);

        entities.forEach(e => {
            ctx.save();
            ctx.translate(e.body.position.x, e.body.position.y);
            ctx.rotate(e.body.angle);
            
            ctx.shadowBlur = 15; ctx.shadowColor = e.color; ctx.fillStyle = e.color;
            
            if (e.type === 'coin') {
                ctx.beginPath(); ctx.arc(0, 0, e.w/2, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
                ctx.strokeRect(-e.w/2, -e.h/2, e.w, e.h);
            }
            ctx.restore();
        });

        ctx.shadowBlur = 10; ctx.shadowColor = '#ffff00'; ctx.fillStyle = '#ffff00';
        bullets.forEach(b => {
            ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI * 2); ctx.fill();
        });

        ctx.restore();
    } catch (e) { console.error(e); }
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

    const bL = document.getElementById('btn-left'), bR = document.getElementById('btn-right'), bJ = document.getElementById('btn-jump'), bS = document.getElementById('btn-shoot');
    if(bL) {
        bL.addEventListener('pointerdown', () => keys.left = true); bL.addEventListener('pointerup', () => keys.left = false);
        bR.addEventListener('pointerdown', () => keys.right = true); bR.addEventListener('pointerup', () => keys.right = false);
        bJ.addEventListener('pointerdown', () => doJump());
        bS.addEventListener('pointerdown', () => keys.shoot = true); bS.addEventListener('pointerup', () => keys.shoot = false);
    }
}
