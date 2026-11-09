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
    gameRules = config.game_rules || { player_hp: 100, enemy_hp: 30 };
    
    if (playerBase64) playerImgObj.src = playerBase64;
    if (enemyBase64) enemyImgObj.src = enemyBase64;

    config.entities.forEach(e => {
        let body;
        // 🌟 锁定旋转 inertia: Infinity，让怪物永远站直
        if (e.type === 'ground') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { isStatic: true, render: { fillStyle: 'rgba(0, 255, 204, 0.8)' } });
        else if (e.type === 'obstacle') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { isStatic: true, render: { fillStyle: '#1a1a2e' } }); // 把粉色方块换成暗色实体
        else if (e.type === 'player') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { friction: 0, frictionAir: 0.05, restitution: 0, inertia: Infinity, render: { fillStyle: '#4ea1ff' }, label: 'player' });
        else if (e.type === 'enemy') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { friction: 0, inertia: Infinity, render: { fillStyle: '#ff0000' }, label: 'enemy' });
        
        if (body) {
            World.add(world, body);
            entities.push({ type: e.type, body: body, w: e.w, h: e.h, hp: e.type === 'enemy' ? gameRules.enemy_hp : 0 });
        }
    });

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

    // 1. 胜利条件判定 (AI 设定的 kill_all)
    if (enemies.length === 0) {
        state = 'menu';
        alert('🎉 恭喜通关！你完成了 AI 设计的游戏《' + document.getElementById('hud-title').textContent + '》');
        document.getElementById('exit-btn').click();
        return;
    }

    if (p) {
        // 2. 玩家移动
        let vx = 0;
        if (keys.left) vx = -6; if (keys.right) vx = 6;
        Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

        // 3. 玩家射击
        shootTimer -= dt;
        if (keys.shoot && shootTimer <= 0) {
            let b = Bodies.circle(p.body.position.x, p.body.position.y, 5, { isStatic: false, render: { fillStyle: '#ffff00' }, label: 'bullet' });
            Body.setVelocity(b, { x: 15, y: 0 }); 
            Body.setAngularVelocity(b, 0);
            World.add(world, b);
            bullets.push(b);
            shootTimer = 0.2;
        }

        // 4. 怪物 AI (执行 AI 设定的 chase 追击)
        enemies.forEach(en => {
            let dir = p.body.position.x > en.body.position.x ? 1 : -1;
            Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y });
        });
    }

    // 5. 子弹与怪物碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            let en = enemies[j];
            let dist = Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y);
            if (dist < 35) {
                en.hp -= 10; // 每次扣 10 点血
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
    
    // 6. 渲染
    entities.forEach(e => {
        ctx.save();
        ctx.translate(e.body.position.x, e.body.position.y);
        
        if (e.type === 'player' && playerImgObj.complete) {
            // 如果不抠图，默认用 multiply 叠底去黑
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

    bullets.forEach(b => {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 5, 0, Math.PI * 2); ctx.fill();
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
        bL.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; }); bL.addEventListener('touchend', () => keys.left = false);
        bR.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; }); bR.addEventListener('touchend', () => keys.right = false);
        bJ.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); });
        bS.addEventListener('touchstart', (e) => { e.preventDefault(); keys.shoot = true; }); bS.addEventListener('touchend', () => keys.shoot = false);
    }
}
