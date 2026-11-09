import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

initEngine();

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
    stopGame();
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
    
    // 把用户的参数拼进 prompt 告诉 AI
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情细节：${story}`;

    switchScreen(null);
    document.getElementById('loading-mask').classList.add('show');
    document.getElementById('loading-text').textContent = 'AI 正在推演玩法机制...';

    try {
        tempConfig = await generateWorldConfig(prompt);
        // 强制注入用户设定的数值，覆盖 AI 的懒癌
        tempConfig.user_enemyCount = parseInt(enemyCount) || 10;
        tempConfig.game_rules.enemy_hp = parseInt(enemyHp) || 30;

        document.getElementById('loading-text').textContent = 'AI 绘制背景中...';
        let bgUrl = await requestZhipuImage(tempConfig.bg_prompt);
        if (bgUrl) document.getElementById('preview-img').src = bgUrl;
        
        // 临时存一下背景图
        document.getElementById('game-bg').style.backgroundImage = `url(${bgUrl})`;

        document.getElementById('loading-text').textContent = 'AI 绘制角色并抠图...';
        let pUrl = await requestZhipuImage(tempConfig.player_prompt);
        tempPlayerBase64 = await processImageRemoveBg(pUrl);
        
        let eUrl = await requestZhipuImage(tempConfig.enemy_prompt);
        tempEnemyBase64 = await processImageRemoveBg(eUrl);

        // 展示预览页
        document.getElementById('preview-thoughts').innerHTML = "💡 主策推演: " + tempConfig.design_thoughts;
        switchScreen('preview-screen');
        
        // 保存到历史记录
        saveHistory(prompt, tempConfig);

    } catch(e) {
        alert('生成失败: ' + e.message);
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

// ================= 历史记录功能 =================
function saveHistory(prompt, config) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    // 只存最近 10 个
    history.unshift({ prompt, config, time: new Date().toLocaleString() });
    if (history.length > 10) history.pop();
    localStorage.setItem('game_history', JSON.stringify(history));
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
                <div style="font-size:10px; color:#666; margin-top:4px;">${item.time}</div>
            </div>
        `).join('');
    }
    switchScreen('history-screen');
};

window.loadHistory = function(idx) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    const item = history[idx];
    if(!item) return;
    
    // 这里为了简化，直接重开他当时的参数
    document.getElementById('form-theme').value = "重新生成的"; 
    document.getElementById('form-enemyCount').value = item.config.user_enemyCount || 10;
    document.getElementById('form-enemyHp').value = item.config.game_rules.enemy_hp || 30;
    document.getElementById('form-story').value = item.prompt;
    
    // 重新生成一次，保证图片缓存不丢
    generateGame();
};
