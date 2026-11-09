const { Engine, World, Bodies, Body } = Matter;
import { createEntity } from './entity-factory.js';
import { initRules, updateRuleState } from './rule-system.js';

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

export function runGame(config, playerBase64, enemyBase64) {
    state = 'playing';
    engine = Engine.create();
    world = engine.world;
    window.world = world;
    engine.gravity.y = 1; 
    entities = []; bullets = [];
    
    initRules(config.game_rules);
    currentRules = config.game_rules || {};
    
    if (playerBase64) playerImgObj.src = playerBase64;
    if (enemyBase64) enemyImgObj.src = enemyBase64;

    // 自动排版：不管 AI 怎么给，确保地面铺满，主角在左，敌人在右
    const floorY = canvas.height - 80;
    let groundBody = createEntity('ground', canvas.width / 2, floorY + 20, canvas.width, 40);
    World.add(world, groundBody);
    entities.push({ type: 'ground', body: groundBody, w: canvas.width, h: 40 });

    let playerBody = createEntity('player', 100, floorY - 100, 40, 60);
    World.add(world, playerBody);
    entities.push({ type: 'player', body: playerBody, w: 40, h: 60 });

    let enemiesFromAI = config.entities.filter(e => e.type === 'enemy');
    let enemyCount = enemiesFromAI.length > 0 ? enemiesFromAI.length : 3;
    
    // 怪物生成
    for (let i = 0; i < enemyCount; i++) {
        let ex = canvas.width - 150 - (i * 80);
        let enemyBody = createEntity('enemy', ex, floorY - 100, 40, 40);
        World.add(world, enemyBody);
        entities.push({ type: 'enemy', body: enemyBody, w: 40, h: 40, hp: currentRules.enemy_hp || 30 });
    }

    // 如果 AI 设定要收集金币，生成金币
    if (currentRules.win_condition === 'collect_coins') {
        for (let i = 0; i < (currentRules.target_value || 5); i++) {
            let coinBody = createEntity('coin', 200 + i * 80, floorY - 150, 20, 20);
            World.add(world, coinBody);
            entities.push({ type: 'coin', body: coinBody, w: 20, h: 20 });
        }
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
    const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    
    const p = entities.find(e => e.type === 'player');
    const enemies = entities.filter(e => e.type === 'enemy');

    if (p) {
        let vx = 0;
        if (keys.left) vx = -(currentRules.player_speed || 6);
        if (keys.right) vx = currentRules.player_speed || 6;
        Body.setVelocity(p.body, { x: vx, y: p.body.velocity.y });

        shootTimer -= dt;
        if (keys.shoot && shootTimer <= 0) {
            let b = Bodies.circle(p.body.position.x + 20, p.body.position.y, 6, { isStatic: false, render: { fillStyle: '#ffff00' }, label: 'bullet' });
            Body.setVelocity(b, { x: 15, y: 0 }); 
            World.add(world, b); bullets.push(b);
            shootTimer = 0.15;
        }

        // AI 定义的怪物行为
        enemies.forEach(en => {
            let dir = p.body.position.x > en.body.position.x ? 1 : -1;
            if (currentRules.enemy_behavior === 'fly') {
                Body.setVelocity(en.body, { x: dir * 3, y: Math.sin(now / 200) * 5 }); // 飞怪，上下浮动
            } else {
                Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y }); // 走地怪追击
            }
        });
    }

    // 调用规则系统
    updateRuleState(
        entities, bullets, p ? p.body : null,
        (enemyNum, score) => {
            let hud = document.getElementById('hud');
            if(hud) hud.innerHTML = `敌人剩余: ${enemyNum} | 金币: ${score}`;
        },
        () => { alert("💀 你阵亡了！"); document.getElementById('exit-btn').click(); },
        () => { alert("🎉 恭喜你完成了 AI 设计的《" + document.getElementById('hud-title').textContent + "》"); document.getElementById('exit-btn').click(); }
    );

    Engine.update(engine, dt * 1000);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
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
            if(e.type === 'coin') { ctx.beginPath(); ctx.arc(0,0,e.w/2,0,Math.PI*2); ctx.fill(); }
            else ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
        }
        ctx.restore();
    });

    bullets.forEach(b => {
        ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI * 2); ctx.fill();
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
        bL.addEventListener('pointerdown', (e) => { keys.left = true; }); bL.addEventListener('pointerup', () => keys.left = false);
        bR.addEventListener('pointerdown', (e) => { keys.right = true; }); bR.addEventListener('pointerup', () => keys.right = false);
        bJ.addEventListener('pointerdown', (e) => { doJump(); });
        bS.addEventListener('pointerdown', (e) => { keys.shoot = true; }); bS.addEventListener('pointerup', () => keys.shoot = false);
    }
}
