import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

const $ = (id) => document.getElementById(id);
try { initEngine(); } catch (e) { console.error('引擎初始化失败', e); }

let currentCategory = 'shooter';
let tempConfig = null;
let tempPlayerBase64 = null;
let tempEnemyBase64 = null;

window.openForm = function(type, title) {
    currentCategory = type;
    if($('form-title')) $('form-title').textContent = '定制 ' + title;
    switchScreen('form-screen');
};

window.backToMenu = function() {
    switchScreen('menu-screen');
    try { stopGame(); } catch(e) {}
    ['canvas2d', 'game-bg', 'controls', 'exit-btn', 'hud'].forEach(id => {
        const el = $(id); if (el) el.style.display = 'none';
    });
};

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    if (id && $(id)) $(id).classList.add('active');
}

window.generateGame = async function() {
    const theme = $('form-theme')?.value || '赛博';
    const enemyCount = $('form-enemyCount')?.value || '10';
    const enemyHp = $('form-enemyHp')?.value || '30';
    const story = $('form-story')?.value || '魂斗罗';
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情：${story}`;

    switchScreen(null);
    if($('loading-mask')) $('loading-mask').classList.add('show');
    
    try {
        if($('loading-text')) $('loading-text').textContent = 'AI 推演关卡图纸中...';
        tempConfig = await generateWorldConfig(prompt);
        
        // 记录兜底状态
        const isFallback = tempConfig.fallback;

        if($('loading-text')) $('loading-text').textContent = 'AI 绘制背景中...';
        let bgUrl = await requestZhipuImage(tempConfig.bg_prompt);
        if (bgUrl) {
            if ($('preview-img')) $('preview-img').src = bgUrl;
            if ($('game-bg')) $('game-bg').style.backgroundImage = `url("${bgUrl}")`;
        } else {
            if ($('game-bg')) $('game-bg').style.background = 'linear-gradient(to bottom, #0f172a, #1e1b4b)';
        }

        if($('loading-text')) $('loading-text').textContent = 'AI 绘制主角与敌人...';
        // 强制白底，消除冲突
        let pUrl = await requestZhipuImage(`${tempConfig.player_prompt || '战士'}，全身立绘，纯白色背景`).catch(()=>null);
        tempPlayerBase64 = await processImageRemoveBg(pUrl);
        
        let eUrl = await requestZhipuImage(`${tempConfig.enemy_prompt || '怪物'}，全身立绘，纯白色背景`).catch(()=>null);
        tempEnemyBase64 = await processImageRemoveBg(eUrl);

        if($('preview-thoughts')) {
            const fallbackTag = isFallback ? '<span style="color:#ff0066;">[安全模式]</span> ' : '';
            $('preview-thoughts').innerHTML = "💡 主策推演: " + fallbackTag + (tempConfig.design_thoughts || '无');
        }
        
        switchScreen('preview-screen');
        saveHistory(prompt, tempConfig);

    } catch(e) {
        alert('生成失败: ' + e.message);
        backToMenu();
    } finally {
        if($('loading-mask')) $('loading-mask').classList.remove('show');
    }
};

window.startPlay = function() {
    if (!tempConfig) return;
    switchScreen(null);
    ['canvas2d', 'game-bg', 'exit-btn'].forEach(id => { if($(id)) $(id).style.display = 'block'; });
    if($('controls')) $('controls').style.display = 'flex';

    try {
        runGame(tempConfig, tempPlayerBase64, tempEnemyBase64);
    } catch (e) {
        alert('启动失败: ' + e.message);
        backToMenu();
    }
};

// 历史记录逻辑保持不变...
function saveHistory(prompt, config) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    history.unshift({ prompt, config, time: new Date().toLocaleString() });
    if (history.length > 10) history.pop();
    localStorage.setItem('game_history', JSON.stringify(history));
}
window.showHistory = function() {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    const list = $('history-list'); if (!list) return;
    if (history.length === 0) list.innerHTML = '<p style="color:#666;text-align:center;">暂无记录</p>';
    else list.innerHTML = history.map((item, idx) => `
        <div class="history-item" onclick="loadHistory(${idx})">
            <div style="font-weight:700;color:#00ffcc;">${item.config.title}</div>
            <div style="font-size:12px;color:#aaa;margin-top:4px;">${item.prompt}</div>
        </div>`).join('');
    switchScreen('history-screen');
};
window.loadHistory = function(idx) {
    let history = JSON.parse(localStorage.getItem('game_history') || '[]');
    const item = history[idx]; if(!item) return;
    if($('form-theme')) $('form-theme').value = "重新生成"; 
    if($('form-story')) $('form-story').value = item.prompt;
    generateGame();
};
