import { generateWorldConfig } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

try { initEngine(); } catch(e) { alert("物理引擎加载失败：" + e.message); }

let tempConfig = null;
let currentCategory = 'shooter';

window.openForm = function(type, title) {
    currentCategory = type;
    document.getElementById('form-title').textContent = '定制 ' + title;
    switchScreen('form-screen');
};

window.backToMenu = function() {
    switchScreen('menu-screen');
    try { stopGame(); } catch(e) {}
    document.getElementById('canvas2d').style.display = 'none';
    document.getElementById('game-bg').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
    document.getElementById('exit-btn').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
};

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
}

window.generateGame = async function() {
    const theme = document.getElementById('form-theme').value;
    const enemyCount = document.getElementById('form-enemyCount').value;
    const enemyHp = document.getElementById('form-enemyHp').value;
    const story = document.getElementById('form-story').value;
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情细节：${story}`;

    switchScreen(null);
    document.getElementById('loading-mask').classList.add('show');
    document.getElementById('loading-text').textContent = 'AI 正在构建世界法则...';

    try {
        tempConfig = await generateWorldConfig(prompt);
        tempConfig.user_enemyCount = parseInt(enemyCount) || 10;
        
        document.getElementById('preview-title').textContent = tempConfig.title || '未命名世界';
        document.getElementById('preview-thoughts').innerHTML = "💡 主策推演: " + tempConfig.design_thoughts;
        
        switchScreen('preview-screen');
        saveHistory(prompt, tempConfig);
    } catch(e) {
        alert(e.message);
        backToMenu();
    } finally {
        document.getElementById('loading-mask').classList.remove('show');
    }
};

window.startPlay = function() {
    switchScreen(null);
    document.getElementById('canvas2d').style.display = 'block';
    document.getElementById('game-bg').style.display = 'block';
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('exit-btn').style.display = 'block';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('hud-title').textContent = tempConfig.title;
    
    runGame(tempConfig);
};

function saveHistory(prompt, config) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    history.unshift({ prompt, config, time: new Date().toLocaleString() });
    if (history.length > 10) history.pop();
    try { localStorage.setItem('game_history', JSON.stringify(history)); } catch(e) {}
}

window.showHistory = function() {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    const list = document.getElementById('history-list');
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
    tempConfig = item.config;
    document.getElementById('preview-title').textContent = tempConfig.title || '历史世界';
    document.getElementById('preview-thoughts').innerHTML = "💡 历史回放: " + tempConfig.design_thoughts;
    switchScreen('preview-screen');
};
