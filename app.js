import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

try { initEngine(); } catch(e) { alert("引擎加载失败：" + e.message); }

let currentCategory = 'shooter';
let tempConfig = null;
let tempPlayerBase64 = null;
let tempEnemyBase64 = null;

window.openForm = function(type, title) {
    currentCategory = type;
    if(document.getElementById('form-title')) document.getElementById('form-title').textContent = '定制 ' + title;
    switchScreen('form-screen');
};

window.backToMenu = function() {
    switchScreen('menu-screen');
    try { stopGame(); } catch(e) {}
    if(document.getElementById('canvas2d')) document.getElementById('canvas2d').style.display = 'none';
    if(document.getElementById('game-bg')) document.getElementById('game-bg').style.display = 'none';
    if(document.getElementById('controls')) document.getElementById('controls').style.display = 'none';
    if(document.getElementById('exit-btn')) document.getElementById('exit-btn').style.display = 'none';
    if(document.getElementById('hud')) document.getElementById('hud').style.display = 'none';
};

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    if (id && document.getElementById(id)) document.getElementById(id).classList.add('active');
}

window.generateGame = async function() {
    const theme = document.getElementById('form-theme')?.value || '赛博';
    const enemyCount = document.getElementById('form-enemyCount')?.value || '10';
    const enemyHp = document.getElementById('form-enemyHp')?.value || '30';
    const story = document.getElementById('form-story')?.value || '魂斗罗';
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情：${story}`;

    switchScreen(null);
    if(document.getElementById('loading-mask')) document.getElementById('loading-mask').classList.add('show');
    if(document.getElementById('loading-text')) document.getElementById('loading-text').textContent = 'AI 推演玩法中...';

    try {
        tempConfig = await generateWorldConfig(prompt);
        tempConfig.user_enemyCount = parseInt(enemyCount) || 10;
        if(!tempConfig.game_rules) tempConfig.game_rules = {};
        tempConfig.game_rules.enemy_hp = parseInt(enemyHp) || 30;

        if(document.getElementById('loading-text')) document.getElementById('loading-text').textContent = 'AI 绘制背景中...';
        let bgUrl = await requestZhipuImage(tempConfig.bg_prompt);
        
        // 🌟 核心防御 1：如果元素存在，才去赋值
        if (bgUrl) {
            if (document.getElementById('preview-img')) document.getElementById('preview-img').src = bgUrl;
            if (document.getElementById('game-bg')) document.getElementById('game-bg').style.backgroundImage = `url(${bgUrl})`;
        } else {
            if (document.getElementById('game-bg')) document.getElementById('game-bg').style.background = 'linear-gradient(to bottom, #0f172a, #1e1b4b)';
        }

        if(document.getElementById('loading-text')) document.getElementById('loading-text').textContent = 'AI 绘制角色...';
        let pUrl = await requestZhipuImage(tempConfig.player_prompt);
        tempPlayerBase64 = await processImageRemoveBg(pUrl);
        
        let eUrl = await requestZhipuImage(tempConfig.enemy_prompt);
        tempEnemyBase64 = await processImageRemoveBg(eUrl);

        if(document.getElementById('preview-thoughts')) document.getElementById('preview-thoughts').innerHTML = "💡 主策推演: " + tempConfig.design_thoughts;
        switchScreen('preview-screen');
        saveHistory(prompt, tempConfig);

    } catch(e) {
        alert('生成失败: ' + e.message);
        backToMenu();
    } finally {
        if(document.getElementById('loading-mask')) document.getElementById('loading-mask').classList.remove('show');
    }
};

window.startPlay = function() {
    switchScreen(null);
    if(document.getElementById('canvas2d')) document.getElementById('canvas2d').style.display = 'block';
    if(document.getElementById('game-bg')) document.getElementById('game-bg').style.display = 'block';
    if(document.getElementById('controls')) document.getElementById('controls').style.display = 'flex';
    if(document.getElementById('exit-btn')) document.getElementById('exit-btn').style.display = 'block';
    if(document.getElementById('hud')) document.getElementById('hud').style.display = 'block';
    if(document.getElementById('hud-title')) document.getElementById('hud-title').textContent = tempConfig.title;
    runGame(tempConfig, tempPlayerBase64, tempEnemyBase64);
};

function saveHistory(prompt, config) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    history.unshift({ prompt, config, time: new Date().toLocaleString() });
    if (history.length > 10) history.pop();
    localStorage.setItem('game_history', JSON.stringify(history));
}

window.showHistory = function() {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    const list = document.getElementById('history-list');
    if (!list) return;
    if (history.length === 0) {
        list.innerHTML = '<p style="color:#666; text-align:center;">暂无记录</p>';
    } else {
        list.innerHTML = history.map((item, idx) => `
            <div class="history-item" onclick="loadHistory(${idx})">
                <div style="font-weight:700; color:#00ffcc;">${item.config.title}</div>
                <div style="font-size:12px; color:#aaa; margin-top:4px;">${item.prompt}</div>
            </div>
        `).join('');
    }
    switchScreen('history-screen');
};

window.loadHistory = function(idx) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    const item = history[idx];
    if(!item) return;
    if(document.getElementById('form-theme')) document.getElementById('form-theme').value = "重新生成"; 
    if(document.getElementById('form-enemyCount')) document.getElementById('form-enemyCount').value = item.config.user_enemyCount || 10;
    if(document.getElementById('form-enemyHp')) document.getElementById('form-enemyHp').value = item.config.game_rules.enemy_hp || 30;
    if(document.getElementById('form-story')) document.getElementById('form-story').value = item.prompt;
    generateGame();
};
