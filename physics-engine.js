import { createEntity } from './entity-factory.js';
import { initRules, updateRuleState } from './rule-system.js';

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
    
    // 🌟 核心：用滤色模式渲染，如果图片没抠干净，黑底会直接透明
    if (playerBase64) playerImgObj.src = playerBase64;
    if (enemyBase64) enemyImgObj.src = enemyBase64;

    const floorY = canvas.height - 80;
    
    // 1. 地面
    let groundBody = createEntity('ground', canvas.width / 2, floorY + 20, canvas.width, 40);
    World.add(world, groundBody);
    entities.push({ type: 'ground', body: groundBody, w: canvas.width, h: 40 });

    // 2. 主角
    let playerBody = createEntity('player', 100, floorY - 100, 40, 60);
    World.add(world, playerBody);
    entities.push({ type: 'player', body: playerBody, w: 40, h: 60 });

    // 3. 怪物 (数量严格遵守用户表单输入)
    let enemyCount = config.user_enemyCount || 10;
    for (let i = 0; i < enemyCount; i++) {
        // 让怪物在右侧分散开来
        let ex = canvas.width - 50 - (i % 5) * 60; 
        let ey = floorY - 80 - Math.floor(i / 5) * 60;
        let enemyBody = createEntity('enemy', ex, ey, 40, 40);
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

            shootTimer -= dt;
            if (keys.shoot && shootTimer <= 0) {
                let b = Bodies.circle(p.body.position.x + 20, p.body.position.y, 6, { isStatic: false, render: { fillStyle: '#ffff00' }, label: 'bullet' });
                Body.setVelocity(b, { x: 15, y: 0 }); 
                World.add(world, b); bullets.push(b);
                shootTimer = 0.15;
            }

            enemies.forEach(en => {
                let dir = p.body.position.x > en.body.position.x ? 1 : -1;
                // 严格按照 AI 的策划行动
                if (currentRules.enemy_behavior === 'fly') {
                    Body.setVelocity(en.body, { x: dir * 3, y: Math.sin(now / 200) * 5 }); 
                } else {
                    Body.setVelocity(en.body, { x: dir * 3, y: en.body.velocity.y }); 
                }
            });
        }

        updateRuleState(
            entities, bullets, p ? p.body : null,
            (enemyNum) => {
                let hud = document.getElementById('hud');
                if(hud) hud.innerHTML = `<div style="font-weight:700; margin-bottom:4px;">${document.getElementById('hud-title')?.textContent || '游戏'}</div><div style="color:#00ffcc;">敌人剩余: ${enemyNum}</div>`;
            },
            () => { alert("💀 你阵亡了！"); document.getElementById('exit-btn').click(); },
            () => { alert("🎉 恭喜你！成功通关！"); document.getElementById('exit-btn').click(); }
        );

        Engine.update(engine, dt * 1000);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        entities.forEach(e => {
            ctx.save();
            ctx.translate(e.body.position.x, e.body.position.y);
            
            if (e.type === 'player' && playerImgObj.complete) {
                // 🌟 使用 screen 滤色模式，完美解决残留黑边！
                ctx.globalCompositeOperation = 'screen'; 
                ctx.drawImage(playerImgObj, -e.w/2, -e.h/2, e.w, e.h);
            } else if (e.type === 'enemy' && enemyImgObj.complete) {
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(enemyImgObj, -e.w/2, -e.h/2, e.w, e.h);
            } else {
                ctx.fillStyle = e.body.render.fillStyle;
                ctx.fillRect(-e.w/2, -e.h/2, e.w, e.h);
            }
            ctx.restore();
        });

        bullets.forEach(b => {
            ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 6, 0, Math.PI * 2); ctx.fill();
        });
    } catch (e) {
        console.error(e);
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

    const bL = document.getElementById('btn-left'), bR = document.getElementById('btn-right'), bJ = document.getElementById('btn-jump'), bS = document.getElementById('btn-shoot');
    if(bL) {
        bL.addEventListener('pointerdown', () => keys.left = true); bL.addEventListener('pointerup', () => keys.left = false);
        bR.addEventListener('pointerdown', () => keys.right = true); bR.addEventListener('pointerup', () => keys.right = false);
        bJ.addEventListener('pointerdown', () => doJump());
        bS.addEventListener('pointerdown', () => keys.shoot = true); bS.addEventListener('pointerup', () => keys.shoot = false);
    }
}
