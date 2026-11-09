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
let gameRules = {};

export function initEngine() {
    canvas = document.getElementById('canvas2d');
    ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeight; });
    bindControls();
}

export function stopGame() {
    state = 'menu';
    if (engine) { Engine.clear(engine); World.clear(world); }
    bullets = [];
    entities = [];
}

export function runGame(config, playerBase64, enemyBase64) {
    state = 'playing';
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1; 
    entities = [];
    bullets = [];
    gameRules = config.game_rules || { enemy_hp: 30 };
    
    if (playerBase64) playerImgObj.src = playerBase64;
    if (enemyBase64) enemyImgObj.src = enemyBase64;

    // 🌟 核心修复：不再使用 AI 给的绝对坐标，直接根据当前屏幕尺寸重新计算！
    const floorY = canvas.height - 80;
    
    // 1. 强制生成地面 (全屏宽度)
    let groundBody = Bodies.rectangle(canvas.width / 2, floorY + 20, canvas.width, 40, { 
        isStatic: true, 
        render: { fillStyle: 'rgba(0, 255, 204, 0.6)' } 
    });
    World.add(world, groundBody);
    entities.push({ type: 'ground', body: groundBody, w: canvas.width, h: 40 });

    // 2. 强制生成主角 (在屏幕左侧)
    let playerBody = Bodies.rectangle(100, floorY - 100, 40, 60, { 
        friction: 0, frictionAir: 0.05, restitution: 0, inertia: Infinity, 
        render: { fillStyle: '#4ea1ff' }, label: 'player' 
    });
    World.add(world, playerBody);
    entities.push({ type: 'player', body: playerBody, w: 40, h: 60 });

    // 3. 根据 AI 想要的数量，在屏幕右侧均匀生成怪物
    const enemyCount = config.entities.filter(e => e.type === 'enemy').length || 3;
    for (let i = 0; i < enemyCount; i++) {
        let ex = canvas.width - 150 - (i * 80); // 从右往左排开
        let enemyBody = Bodies.rectangle(ex, floorY - 100, 40, 40, { 
            friction: 0, inertia: Infinity, 
            render: { fillStyle: '#ff0000' }, label: 'enemy' 
        });
        World.add(world, enemyBody);
        entities.push({ type: 'enemy', body: enemyBody, w: 40, h: 40, hp: gameRules.enemy_hp });
    }

    requestAnimationFrame(loop);
}

function doJump() {
    const p = entities.find(e => e.type === 'player');
    if (p && Math.abs(p.body.velocity.y) < 2) Body.setVelocity(p.body, { x: p.body.velocity.x, y: -14 });
}

let lastTime = 0;
function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    
    const p = entities.find(e => e.type === 'player');
    const enemies = entities.filter(e => e.type === 'enemy');

    if (enemies.length === 0) {
        state = 'menu';
        alert('🎉 恭喜通关！你消灭了所有敌人！');
        document.getElementById('exit-btn').click();
        return;
    }

    if (p) {
        let vx = 0;
        if (keys.left) vx = -6; 
        if (keys.right) vx = 6;
        Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

        // 射击逻辑
        shootTimer -= dt;
        if (keys.shoot && shootTimer <= 0) {
            let b = Bodies.circle(p.body.position.x + 20, p.body.position.y, 6, { isStatic: false, render: { fillStyle: '#ffff00' }, label: 'bullet' });
            Body.setVelocity(b, { x: 15, y: 0 }); 
            World.add(world, b);
            bullets.push(b);
            shootTimer = 0.15;
        }

        // 怪物 AI 追击
        enemies.forEach(en => {
            let dir = p.body.position.x > en.body.position.x ? 1 : -1;
            Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y });
        });
    }

    // 子弹碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            let en = enemies[j];
            let dist = Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y);
            if (dist < 40) {
                en.hp -= 10; 
                World.remove(world, b); bullets.splice(i, 1);
                if (en.hp <= 0) {
                    World.remove(world, en.body); entities.splice(entities.indexOf(en), 1);
                }
                break;
            }
        }
        if (b.position.x > canvas.width || b.position.x < 0) { World.remove(world, b); bullets.splice(i, 1); }
    }

    Engine.update(engine, dt * 1000);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制实体
    entities.forEach(e => {
        ctx.save();
        ctx.translate(e.body.position.x, e.body.position.y);
        
        if (e.type === 'player' && playerImgObj.complete) {
            ctx.globalCompositeOperation = 'multiply'; 
            ctx.drawImage(playerImgObj, -e.w/2, -e.h/2, e.w, e.h);
        } else if (e.type === 'enemy' && enemyImgObj.complete) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(enemyImgObj, -e.w/2, -e.h/2, e.w, e.h);
        } else {
            ctx.fillStyle = e.body.render.fillStyle;
            ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        }
        ctx.restore();
    });

    // 绘制子弹
    bullets.forEach(b => {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI * 2); ctx.fill();
    });
    
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
        // 统一使用 pointerdown/pointerup 完美兼容鼠标和触屏
        bL.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.left = true; }); 
        bL.addEventListener('pointerup', () => keys.left = false);
        bL.addEventListener('pointerleave', () => keys.left = false);

        bR.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.right = true; }); 
        bR.addEventListener('pointerup', () => keys.right = false);
        bR.addEventListener('pointerleave', () => keys.right = false);

        bJ.addEventListener('pointerdown', (e) => { e.preventDefault(); doJump(); });

        bS.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.shoot = true; }); 
        bS.addEventListener('pointerup', () => keys.shoot = false);
        bS.addEventListener('pointerleave', () => keys.shoot = false);
    }
}
