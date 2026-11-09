import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

const $ = (id) => document.getElementById(id);

try { initEngine(); } catch (e) { console.error('引擎初始化失败', e); }

let currentCategory = 'shooter';
let tempConfig = null;
let tempPlayerBase64 = null;
let tempEnemyBase64 = null;
let tempBgUrl = null;

// 切换界面
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

// ---------------- 核心：生成新游戏 ----------------
window.generateGame = async function() {
    const theme = $('form-theme')?.value?.trim() || '赛博朋克';
    const enemyCount = Math.max(1, Math.min(50, parseInt($('form-enemyCount')?.value) || 10));
    const enemyHp = Math.max(1, Math.min(999, parseInt($('form-enemyHp')?.value) || 30));
    const story = $('form-story')?.value?.trim() || '魂斗罗式横版射击';
    
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情：${story}`;

    switchScreen(null);
    if($('loading-mask')) $('loading-mask').classList.add('show');
    if($('loading-text')) $('loading-text').textContent = 'AI 推演关卡图纸中...';
    
    try {
        tempConfig = await generateWorldConfig(prompt);
        const isFallback = tempConfig.fallback;

        if($('loading-text')) $('loading-text').textContent = 'AI 绘制美术资源中...';
        
        // 生图并抠图
        tempBgUrl = await requestZhipuImage(`${tempConfig.bg_prompt || theme}，横版游戏背景，宽银幕构图，无文字`).catch(()=>null);
        
        let pUrl = await requestZhipuImage(`${tempConfig.player_prompt || '战士'}，游戏角色立绘，全身，居中，纯白色纯色背景，无文字，正面视角`).catch(()=>null);
        tempPlayerBase64 = await processImageRemoveBg(pUrl).catch(()=>null);
        
        let eUrl = await requestZhipuImage(`${tempConfig.enemy_prompt || '怪物'}，游戏敌人立绘，全身，居中，纯白色纯色背景，无文字，正面视角`).catch(()=>null);
        tempEnemyBase64 = await processImageRemoveBg(eUrl).catch(()=>null);

        // 渲染预览
        renderPreview(tempBgUrl);

        if($('preview-thoughts')) {
            const fallbackTag = isFallback ? '<span style="color:#ff0066;">[安全模式]</span> ' : '';
            $('preview-thoughts').innerHTML = "💡 主策推演: " + fallbackTag + (tempConfig.design_thoughts || '无');
        }

        // 保存到历史（把图片数据一起存了！）
        saveHistory(prompt, tempConfig, theme, {
            bgUrl: tempBgUrl,
            playerBase64: tempPlayerBase64,
            enemyBase64: tempEnemyBase64
        });
        
        switchScreen('preview-screen');

    } catch(e) {
        console.error(e);
        alert('生成失败: ' + (e.message || e));
        backToMenu();
    } finally {
        if($('loading-mask')) $('loading-mask').classList.remove('show');
    }
};

// 公共渲染预览
function renderPreview(bgUrl) {
    if (bgUrl) {
        if ($('preview-img')) $('preview-img').src = bgUrl;
        if ($('game-bg')) $('game-bg').style.backgroundImage = `url("${bgUrl}")`;
    } else {
        if ($('preview-img')) $('preview-img').removeAttribute('src');
        if ($('game-bg')) $('game-bg').style.background = 'linear-gradient(to bottom, #0f172a, #1e1b4b)';
    }
}

// 开始游玩
window.startPlay = function() {
    if (!tempConfig) return alert('游戏配置丢失');
    switchScreen(null);
    ['canvas2d', 'game-bg', 'exit-btn', 'hud'].forEach(id => { 
        const el = $(id); if(el) el.style.display = 'block'; 
    });
    const ctr = $('controls'); if(ctr) ctr.style.display = 'flex';

    const title = $('hud-title'); 
    if (title) title.textContent = tempConfig.title || 'AI 游戏';

    try {
        runGame(tempConfig, tempPlayerBase64, tempEnemyBase64);
    } catch (e) {
        alert('启动失败: ' + e.message);
        backToMenu();
    }
};

// ---------------- 历史记录功能（极致秒开） ----------------

function saveHistory(prompt, config, displayTitle, assets) {
    try {
        const history = JSON.parse(localStorage.getItem('game_history') || '[]');
        history.unshift({ prompt, config, title: displayTitle, assets, time: new Date().toLocaleString() });
        while (history.length > 5) history.pop(); // 存 5 条防止内存爆掉
        localStorage.setItem('game_history', JSON.stringify(history));
    } catch (e) { console.warn('保存历史失败', e); }
}

window.showHistory = function() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch(e){}
    
    const list = $('history-list'); 
    if (!list) return;
    
    if (history.length === 0) {
        list.innerHTML = '<p style="color:#666;text-align:center;margin-top:30px;">暂无记录，快去生成一个吧！</p>';
    } else {
        list.innerHTML = history.map((item, idx) => `
            <div class="history-item" onclick="loadHistory(${idx})" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:700;color:#00ffcc;">${item.config?.title || item.title || '未知游戏'}</div>
                    <div style="font-size:12px;color:#aaa;margin-top:4px;">${item.prompt || ''}</div>
                </div>
                <div style="font-size:11px;color:#666; text-align:right; white-space:nowrap; margin-left:10px;">
                    ${item.time || ''}<br>
                    <span style="color:#4ea1ff;">▶ 读取游玩</span>
                </div>
            </div>
        `).join('');
    }
    switchScreen('history-screen');
};

// 绝对不重新生成，直接复用缓存！
window.loadHistory = function(idx) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch(e){}
    
    const item = history[idx]; 
    if(!item || !item.config) return;
    
    // 1. 瞬间恢复数据（完全没有网络请求）
    tempConfig = item.config;
    
    if (item.assets) {
        tempBgUrl = item.assets.bgUrl;
        tempPlayerBase64 = item.assets.playerBase64;
        tempEnemyBase64 = item.assets.enemyBase64;
    }

    // 2. 渲染预览
    renderPreview(tempBgUrl);

    if($('preview-thoughts')) {
        $('preview-thoughts').innerHTML = "💡 历史关卡已恢复: " + (tempConfig.design_thoughts || '无');
    }
    
    switchScreen('preview-screen');
};
