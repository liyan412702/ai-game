import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

const $ = (id) => document.getElementById(id);

// 初始化物理引擎
try { initEngine(); } catch (e) { console.error('引擎初始化失败', e); }

let currentCategory = 'shooter';
let tempConfig = null;
let tempPlayerBase64 = null;
let tempEnemyBase64 = null;

// 切换界面
window.openForm = function(type, title) {
    currentCategory = type;
    if($('form-title')) $('form-title').textContent = '定制 ' + title;
    switchScreen('form-screen');
};

// 返回主菜单并清理游戏
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
        // 1. 获取规则配置（耗时操作）
        tempConfig = await generateWorldConfig(prompt);
        const isFallback = tempConfig.fallback;

        // 2. 生图并进入预览
        await loadImagesAndPreview(tempConfig);
        
        // 3. 保存到历史
        saveHistory(prompt, tempConfig, theme);
        
        if($('preview-thoughts')) {
            const fallbackTag = isFallback ? '<span style="color:#ff0066;">[安全模式]</span> ' : '';
            $('preview-thoughts').innerHTML = "💡 主策推演: " + fallbackTag + (tempConfig.design_thoughts || '无');
        }

    } catch(e) {
        console.error(e);
        alert('生成失败: ' + (e.message || e));
        backToMenu();
    } finally {
        if($('loading-mask')) $('loading-mask').classList.remove('show');
    }
};

// ---------------- 提取的生图流程（供新生成和历史记录复用） ----------------
async function loadImagesAndPreview(config) {
    if($('loading-text')) $('loading-text').textContent = 'AI 绘制背景中...';
    let bgUrl = await requestZhipuImage(
        `${config.bg_prompt || config.title}，横版游戏背景，宽银幕构图，无文字`
    ).catch(()=>null);

    if (bgUrl) {
        if ($('preview-img')) $('preview-img').src = bgUrl;
        if ($('game-bg')) $('game-bg').style.backgroundImage = `url("${bgUrl}")`;
    } else {
        if ($('preview-img')) $('preview-img').removeAttribute('src');
        if ($('game-bg')) $('game-bg').style.background = 'linear-gradient(to bottom, #0f172a, #1e1b4b)';
    }

    if($('loading-text')) $('loading-text').textContent = 'AI 绘制主角与敌人...';
    let pUrl = await requestZhipuImage(
        `${config.player_prompt || '战士'}，游戏角色立绘，全身，居中，纯白色纯色背景，无文字，正面视角`
    ).catch(()=>null);
    tempPlayerBase64 = await processImageRemoveBg(pUrl).catch(()=>null);
    
    let eUrl = await requestZhipuImage(
        `${config.enemy_prompt || '怪物'}，游戏敌人立绘，全身，居中，纯白色纯色背景，无文字，正面视角`
    ).catch(()=>null);
    tempEnemyBase64 = await processImageRemoveBg(eUrl).catch(()=>null);

    switchScreen('preview-screen');
}

// 开始游玩
window.startPlay = function() {
    if (!tempConfig) {
        alert('游戏配置丢失，请重新生成！');
        return;
    }
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
        console.error(e);
        alert('启动失败: ' + (e.message || e));
        backToMenu();
    }
};

// ---------------- 历史记录功能重构 ----------------

function saveHistory(prompt, config, displayTitle) {
    try {
        const history = JSON.parse(localStorage.getItem('game_history') || '[]');
        // 记录时间戳
        history.unshift({ 
            prompt, 
            config, 
            title: displayTitle,
            time: new Date().toLocaleString() 
        });
        while (history.length > 10) history.pop();
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

// 核心修复：点击历史记录，直接读取配置，跳过大模型推演！
window.loadHistory = async function(idx) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch(e){}
    
    const item = history[idx]; 
    if(!item || !item.config) return;
    
    switchScreen(null);
    if($('loading-mask')) $('loading-mask').classList.add('show');
    if($('loading-text')) $('loading-text').textContent = '正在还原历史世界...';

    try {
        // 1. 直接复用历史配置（不再请求 DeepSeek，秒出！）
        tempConfig = item.config;
        
        // 2. 只需要重新请求图片（因为本地不能存大图）
        await loadImagesAndPreview(tempConfig);

        if($('preview-thoughts')) {
            $('preview-thoughts').innerHTML = "💡 历史关卡已恢复: " + (tempConfig.design_thoughts || '无');
        }
    } catch (e) {
        console.error(e);
        alert('加载历史失败: ' + e.message);
        backToMenu();
    } finally {
        if($('loading-mask')) $('loading-mask').classList.remove('show');
    }
};
