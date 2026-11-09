const { Engine, World, Bodies, Body } = Matter;

let engine, world;
let entities = []; 
let state = 'menu';
let playerImgObj = new Image();
let enemyImgObj = new Image();
let keys = { left: false, right: false };
let canvas, ctx;

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
}

export function runGame(config, playerBase64, enemyBase64) {
    state = 'playing';
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1; 
    entities = [];
    
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
        else if (e.type === 'player') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { friction: 0, frictionAir: 0.05, restitution: 0, render: { fillStyle: '#4ea1ff' } });
        else if (e.type === 'enemy') body = Bodies.rectangle(e.x, e.y, e.w, e.h, { friction: 0.1, render: { fillStyle: '#ff0000' } });
        
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
    
    const p = entities.find(e => e.type === 'player');
    if (p) {
        let vx = 0;
        if (keys.left) vx = -6;
        if (keys.right) vx = 6;
        if (vx !== 0) Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });
        else Body.setVelocity(p.body, { x: 0, y: p.body.velocity.y });
    }

    Engine.update(engine, dt * 1000);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    entities.forEach(e => {
        ctx.save();
        ctx.translate(e.body.position.x, e.body.position.y);
        ctx.rotate(e.body.angle);
        
        if (e.type === 'player' && playerImgObj.complete && playerImgObj.naturalWidth > 0) ctx.drawImage(playerImgObj, -e.w/2, -e.h/2, e.w, e.h);
        else if (e.type === 'enemy' && enemyImgObj.complete && enemyImgObj.naturalWidth > 0) ctx.drawImage(enemyImgObj, -e.w/2, -e.h/2, e.w, e.h);
        else { ctx.fillStyle = e.body.render.fillStyle; ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h); }
        ctx.restore();
    });
    
    requestAnimationFrame(loop);
}

function bindControls() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
        if (e.code === 'Space' || e.key === 'ArrowUp') doJump();
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    });

    const bL = document.getElementById('btn-left'), bR = document.getElementById('btn-right'), bJ = document.getElementById('btn-jump');
    if(bL) {
        bL.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
        bL.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
        bL.addEventListener('mousedown', () => keys.left = true); bL.addEventListener('mouseup', () => keys.left = false);
        bR.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
        bR.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
        bR.addEventListener('mousedown', () => keys.right = true); bR.addEventListener('mouseup', () => keys.right = false);
        bJ.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); });
        bJ.addEventListener('mousedown', () => doJump());
    }
}
