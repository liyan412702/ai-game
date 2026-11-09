import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

try { initEngine(); } catch(e) { alert("物理引擎加载失败：" + e.message); }

let currentCategory = 'shooter';
let tempConfig = null;
let tempPlayerBase64 = null;
let tempEnemyBase64 = null;

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
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情：${story}`;

    switchScreen(null);
    document.getElementById('loading-mask').classList.add('show');
    document.getElementById('loading-text').textContent = 'AI 正在推演玩法机制...';

    try {
        tempConfig = await generateWorldConfig(prompt);
        tempConfig.user_enemyCount = parseInt(enemyCount) || 10;
        if(!tempConfig.game_rules) tempConfig.game_rules = {};
        tempConfig.game_rules.enemy_hp = parseInt(enemyHp) || 30;

        document.getElementById('loading-text').textContent = 'AI 绘制背景中...';
        let bgUrl = await requestZhipuImage(tempConfig.bg_prompt);
        if (bgUrl) document.getElementById('preview-img').src = bgUrl;
        document.getElementById('game-bg').style.backgroundImage = `url(${bgUrl})`;

        document.getElementById('loading-text').textContent = 'AI 绘制角色...';
        let pUrl = await requestZhipuImage(tempConfig.player_prompt);
        tempPlayerBase64 = await processImageRemoveBg(pUrl);
        
        let eUrl = await requestZhipuImage(tempConfig.enemy_prompt);
        tempEnemyBase64 = await processImageRemoveBg(eUrl);

        document.getElementById('preview-thoughts').innerHTML = "💡 主策推演: " + tempConfig.design_thoughts;
        switchScreen('preview-screen');
        
        // 保存历史（把图片 URL 一并存下）
        saveHistory(prompt, tempConfig, bgUrl, pUrl, eUrl);

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
    runGame(tempConfig, tempPlayerBase64, tempEnemyBase64);
};

// ================= 真正的历史记录 =================
function saveHistory(prompt, config, bgUrl, pUrl, eUrl) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    // 注意：Base64 太大，localStorage 存不下，所以这里存原图 URL。展示时可能带黑底，但速度极快。
    history.unshift({ 
        prompt, 
        config, 
        bgUrl, 
        pUrl, 
        eUrl,
        time: new Date().toLocaleString() 
    });
    if (history.length > 10) history.pop();
    
    try {
        localStorage.setItem('game_history', JSON.stringify(history));
    } catch(e) {
        console.warn("本地存储已满，最旧记录被清理");
        history.pop();
        localStorage.setItem('game_history', JSON.stringify(history));
    }
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

    // 🌟 核心：直接从本地缓存恢复，不请求网络！
    tempConfig = item.config;
    document.getElementById('game-bg').style.backgroundImage = `url(${item.bgUrl})`;
    document.getElementById('preview-img').src = item.bgUrl;
    
    // 因为没经过抠图，直接用原 URL 渲染（带黑底但速度快）
    tempPlayerBase64 = item.pUrl;
    tempEnemyBase64 = item.eUrl;
    
    document.getElementById('preview-thoughts').innerHTML = "💡 历史记录回放: " + tempConfig.design_thoughts;
    switchScreen('preview-screen');
};
