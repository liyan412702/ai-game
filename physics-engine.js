const { Engine, World, Bodies, Body } = Matter;

let engine, world;
let entities = []; 
let bullets = []; 
let state = 'menu';
let playerImgObj = new Image();
let enemyImgObj = new Image();
let keys = { left: false, right: false, shoot: false };
let canvas, ctx;
let shootTimer = 0;
let currentRules = {};
let cameraX = 0; 

export function initEngine() {
    canvas = document.getElementById('canvas2d');
    ctx = canvas.getContext('2d');
    window.world = null;
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
    if (engine) { Engine.clear(engine); World.clear(world); }
    bullets = []; entities = [];
}

export function runGame(config, playerBase64, enemyBase64) {
    state = 'playing';
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    
    engine = Engine.create();
    world = engine.world;
    window.world = world;
    engine.gravity.y = 1; 
    entities = []; bullets = [];
    cameraX = 0;
    
    currentRules = config.game_rules || {};
    if (playerBase64) playerImgObj.src = playerBase64;
    if (enemyBase64) enemyImgObj.src = enemyBase64;

    // 确保地面在屏幕底部往上 120 像素的位置，留出按钮空间
    const floorY = canvas.height - 120;
    
    // 1. 地面 (宽1000，绝对够大)
    let groundBody = Bodies.rectangle(0, floorY + 100, 2000, 200, { isStatic: true, render: { fillStyle: '#0a1a2e' } });
    World.add(world, groundBody);
    entities.push({ type: 'ground', body: groundBody, w: 2000, h: 200 });

    // 2. 主角 (固定在左侧)
    let playerBody = Bodies.rectangle(100, floorY - 60, 40, 60, { friction: 0, frictionAir: 0.05, restitution: 0, inertia: Infinity, label: 'player' });
    World.add(world, playerBody);
    entities.push({ type: 'player', body: playerBody, w: 40, h: 60 });

    // 3. 怪物 (均匀分布在右侧)
    let enemyCount = config.user_enemyCount || 10;
    for (let i = 0; i < enemyCount; i++) {
        let ex = 400 + (i % 5) * 80; 
        let ey = floorY - 50 - Math.floor(i / 5) * 80;
        let enemyBody = Bodies.rectangle(ex, ey, 40, 40, { friction: 0, inertia: Infinity, label: 'enemy' });
        World.add(world, enemyBody);
        entities.push({ type: 'enemy', body: enemyBody, w: 40, h: 40, hp: currentRules.enemy_hp || 30 });
    }

    requestAnimationFrame(loop);
}

function doJump() {
    const p = entities.find(e => e.type === 'player');
    if (p && Math.abs(p.body.velocity.y) < 2) Body.setVelocity(p.body, { x: p.body.velocity.x, y: currentRules.player_jump || -14 });
}

let lastTime = 0;
function loop(now) {
    if (state !== 'playing') return;
    try {
        const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
        
        const p = entities.find(e => e.type === 'player');
        const enemies = entities.filter(e => e.type === 'enemy');

        if (p) {
            let vx = 0;
            if (keys.left) vx = -(currentRules.player_speed || 6);
            if (keys.right) vx = currentRules.player_speed || 6;
            Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

            let targetCamX = p.body.position.x - canvas.width / 3;
            if (targetCamX < 0) targetCamX = 0;
            cameraX += (targetCamX - cameraX) * 0.1;

            shootTimer -= dt;
            if (keys.shoot && shootTimer <= 0) {
                // 子弹从主角胸部发出
                let b = Bodies.circle(p.body.position.x + 20, p.body.position.y - 10, 8, { isStatic: false, label: 'bullet' });
                Body.setVelocity(b, { x: 15, y: 0 }); 
                World.add(world, b); bullets.push(b);
                shootTimer = 0.15;
            }

            enemies.forEach(en => {
                let dir = p.body.position.x > en.body.position.x ? 1 : -1;
                if (currentRules.enemy_behavior === 'fly') {
                    Body.setVelocity(en.body, { x: dir * 3, y: Math.sin(now / 200) * 5 }); 
                } else {
                    Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y }); 
                }
            });
        }

        // 子弹碰撞
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
            alert('🎉 恭喜通关！');
            document.getElementById('exit-btn').click();
            return;
        }

        let hud = document.getElementById('hud');
        if(hud) hud.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">${document.getElementById('hud-title')?.textContent || '游戏'}</div><div style="color:#00ffcc;">敌人剩余: ${enemies.length}</div>`;

        Engine.update(engine, dt * 1000);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(-cameraX, 0);

        entities.forEach(e => {
            ctx.save();
            ctx.translate(e.body.position.x, e.body.position.y);
            
            // 🌟 防御性渲染：只有图片完全加载成功才用图片，否则一律画方块，绝对不隐身！
            if (e.type === 'player') {
                if (playerImgObj.complete && playerImgObj.naturalWidth > 0) {
                    ctx.drawImage(playerImgObj, -e.w/2, -e.h/2, e.w, e.h);
                } else {
                    ctx.fillStyle = '#00ffff'; // 没图就是亮蓝色方块
                    ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
                }
            } else if (e.type === 'enemy') {
                if (enemyImgObj.complete && enemyImgObj.naturalWidth > 0) {
                    ctx.drawImage(enemyImgObj, -e.w/2, -e.h/2, e.w, e.h);
                } else {
                    ctx.fillStyle = '#ff0066'; // 没图就是亮红色方块
                    ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
                }
            } else {
                ctx.fillStyle = e.body.render.fillStyle;
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
