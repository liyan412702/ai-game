const { Engine, World, Bodies, Body, Query } = Matter;

let engine, world;
let entities = []; 
let bullets = []; // 🌟 新增子弹数组
let state = 'menu';
let playerImgObj = new Image();
let enemyImgObj = new Image();
let keys = { left: false, right: false, shoot: false };
let canvas, ctx;
let shootTimer = 0;

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
    
    if (playerBase64) playerImgObj.src = playerBase64;
    if (enemyBase64) enemyImgObj.src = enemyBase64;

    if (!config.entities || config.entities.length === 0) {
        config.entities = [
            { type: "ground", x: innerWidth/2, y: innerHeight - 50, w: innerWidth, h: 40 },
            { type: "player", x: 100, y: innerHeight - 150, w: 40, h: 60 },
            { type: "enemy", x: innerWidth - 100, y: innerHeight - 150, w: 40, h: 40 }
        ];
    }

    config.entities.forEach(e => {
        let body;
        if (e.type === 'ground') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { isStatic: true, render: { fillStyle: 'rgba(0, 255, 204, 0.8)' } });
        else if (e.type === 'obstacle') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { isStatic: true, render: { fillStyle: '#ff0066' } });
        else if (e.type === 'player') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { friction: 0, frictionAir: 0.05, restitution: 0, render: { fillStyle: '#4ea1ff' }, label: 'player' });
        else if (e.type === 'enemy') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { friction: 0.1, render: { fillStyle: '#ff0000' }, label: 'enemy' });
        
        if (body) {
            World.add(world, body);
            entities.push({ type: e.type, body: body, w: e.w, h: e.h });
        }
    });

    requestAnimationFrame(loop);
}

function doJump() {
    const p = entities.find(e => e.type === 'player');
    if (p && Math.abs(p.body.velocity.y) < 2) {
        Body.setVelocity(p.body, { x: p.body.velocity.x, y: -14 });
    }
}

let lastTime = 0;
function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    
    // 1. 玩家移动逻辑
    const p = entities.find(e => e.type === 'player');
    if (p) {
        let vx = 0;
        if (keys.left) vx = -6;
        if (keys.right) vx = 6;
        if (vx !== 0) Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });
        else Body.setVelocity(p.body, { x: 0, y: p.body.velocity.y });

        // 射击逻辑 (每0.2秒射一发)
        shootTimer -= dt;
        if (keys.shoot && shootTimer <= 0) {
            let b = Bodies.circle(p.body.position.x, p.body.position.y, 5, { isStatic: false, render: { fillStyle: '#ffff00' }, label: 'bullet' });
            Body.setVelocity(b, { x: 12, y: 0 }); // 默认往右射
            World.add(world, b);
            bullets.push(b);
            shootTimer = 0.2;
        }
    }

    // 2. 怪物AI逻辑 (追着玩家跑)
    const enemies = entities.filter(e => e.type === 'enemy');
    if (p) {
        enemies.forEach(en => {
            let dir = p.body.position.x > en.body.position.x ? 1 : -1;
            Body.setVelocity(en.body, { x: dir * 2, y: en.body.velocity.y });
        });
    }

    // 3. 子弹碰撞检测
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            let en = enemies[j];
            // 简单的距离碰撞检测
            let dist = Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y);
            if (dist < 30) {
                World.remove(world, b);
                bullets.splice(i, 1);
                World.remove(world, en.body);
                entities.splice(entities.indexOf(en), 1);
                break; // 子弹消失，跳出怪物循环
            }
        }
        // 清理飞出屏幕的子弹
        if (b.position.x > canvas.width || b.position.x < 0 || b.position.y > canvas.height) {
            World.remove(world, b);
            bullets.splice(i, 1);
        }
    }

    Engine.update(engine, dt * 1000);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 4. 渲染逻辑
    entities.forEach(e => {
        ctx.save();
        ctx.translate(e.body.position.x, e.body.position.y);
        ctx.rotate(e.body.angle);
        
        if (e.type === 'player' && playerImgObj.complete && playerImgObj.naturalWidth > 0) {
            // 🌟 修复黑底：如果图片带黑底，我们用 multiply 模式让黑色变透明
            ctx.globalCompositeOperation = 'multiply'; 
            ctx.drawImage(playerImgObj, -e.w/2, -e.h/2, e.w, e.h);
        } else if (e.type === 'enemy' && enemyImgObj.complete && enemyImgObj.naturalWidth > 0) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(enemyImgObj, -e.w/2, -e.h/2, e.w, e.h);
        } else {
            ctx.fillStyle = e.body.render.fillStyle;
            ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        }
        ctx.restore();
    });

    // 渲染子弹
    bullets.forEach(b => {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(b.position.x, b.position.y, 5, 0, Math.PI * 2);
        ctx.fill();
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
        bL.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
        bL.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
        bL.addEventListener('mousedown', () => keys.left = true); bL.addEventListener('mouseup', () => keys.left = false);
        
        bR.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
        bR.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
        bR.addEventListener('mousedown', () => keys.right = true); bR.addEventListener('mouseup', () => keys.right = false);
        
        bJ.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); });
        bJ.addEventListener('mousedown', () => doJump());
        
        bS.addEventListener('touchstart', (e) => { e.preventDefault(); keys.shoot = true; });
        bS.addEventListener('touchend', (e) => { e.preventDefault(); keys.shoot = false; });
        bS.addEventListener('mousedown', () => keys.shoot = true); bS.addEventListener('mouseup', () => keys.shoot = false);
    }
}
