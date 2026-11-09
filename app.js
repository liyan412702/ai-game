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
    
    // 隐藏游戏内的所有 UI
    ['canvas2d', 'game-bg', 'controls', 'exit-btn', 'hud'].forEach(id => {
        const el = $(id); if (el) el.style.display = 'none';
    });
};

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    if (id && $(id)) $(id).classList.add('active');
}

// 核心流程：生成游戏
window.generateGame = async function() {
    const theme = $('form-theme')?.value?.trim() || '赛博朋克';
    const enemyCount = Math.max(1, Math.min(50, parseInt($('form-enemyCount')?.value) || 10));
    const enemyHp = Math.max(1, Math.min(999, parseInt($('form-enemyHp')?.value) || 30));
    const story = $('form-story')?.value?.trim() || '魂斗罗式横版射击，消灭所有敌人';
    
    // 把这些数据一起传给后端 DeepSeek
    const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情：${story}`;

    switchScreen(null);
    if($('loading-mask')) $('loading-mask').classList.add('show');
    if($('loading-text')) $('loading-text').textContent = 'AI 推演关卡图纸中...';
    
    try {
        // 1. 获取地图/规则数据
        tempConfig = await generateWorldConfig(prompt);
        
        // 记录兜底状态（防网络波动）
        const isFallback = tempConfig.fallback;

        // 2. 绘制背景
        if($('loading-text')) $('loading-text').textContent = 'AI 绘制背景中...';
        let bgUrl = await requestZhipuImage(
            `${tempConfig.bg_prompt || theme}，横版游戏背景，宽银幕构图，无文字`
        ).catch(()=>null);

        if (bgUrl) {
            if ($('preview-img')) $('preview-img').src = bgUrl;
            if ($('game-bg')) $('game-bg').style.backgroundImage = `url("${bgUrl}")`;
        } else {
            if ($('preview-img')) $('preview-img').removeAttribute('src');
            if ($('game-bg')) $('game-bg').style.background = 'linear-gradient(to bottom, #0f172a, #1e1b4b)';
        }

        // 3. 绘制主角与敌人
        if($('loading-text')) $('loading-text').textContent = 'AI 绘制主角与敌人...';
        
        // 强制加上“纯白色背景”提示词，配合抠图逻辑消除黑底
        let pUrl = await requestZhipuImage(
            `${tempConfig.player_prompt || '赛博朋克战士'}，游戏角色立绘，全身，居中，纯白色纯色背景，无文字，无阴影，正面视角`
        ).catch(()=>null);
        tempPlayerBase64 = await processImageRemoveBg(pUrl).catch(()=>null);
        
        let eUrl = await requestZhipuImage(
            `${tempConfig.enemy_prompt || '赛博朋克怪物'}，游戏敌人立绘，全身，居中，纯白色纯色背景，无文字，无阴影，正面视角`
        ).catch(()=>null);
        tempEnemyBase64 = await processImageRemoveBg(eUrl).catch(()=>null);

        // 4. 渲染预览界面
        if($('preview-thoughts')) {
            const fallbackTag = isFallback ? '<span style="color:#ff0066;">[安全模式]</span> ' : '';
            $('preview-thoughts').innerHTML = "💡 主策推演: " + fallbackTag + (tempConfig.design_thoughts || '无');
        }
        
        switchScreen('preview-screen');
        saveHistory(prompt, tempConfig);

    } catch(e) {
        console.error(e);
        alert('生成失败: ' + (e.message || e));
        backToMenu();
    } finally {
        if($('loading-mask')) $('loading-mask').classList.remove('show');
    }
};

// 开始游玩
window.startPlay = function() {
    if (!tempConfig) {
        alert('游戏配置丢失，请重新生成！');
        return;
    }
    
    switchScreen(null);
    
    // 显示游戏层和 HUD
    ['canvas2d', 'game-bg', 'exit-btn', 'hud'].forEach(id => { 
        const el = $(id); 
        if(el) el.style.display = 'block'; 
    });
    
    // 显示控制按钮（flex 布局）
    const ctr = $('controls');
    if(ctr) ctr.style.display = 'flex';

    // 更新左上角的游戏标题
    const title = $('hud-title'); 
    if (title) title.textContent = tempConfig.title || 'AI 游戏';

    try {
        // 启动物理引擎
        runGame(tempConfig, tempPlayerBase64, tempEnemyBase64);
    } catch (e) {
        console.error(e);
        alert('启动失败: ' + (e.message || e));
        backToMenu();
    }
};

// 保存历史
function saveHistory(prompt, config) {
    try {
        const history = JSON.parse(localStorage.getItem('game_history') || '[]');
        history.unshift({ prompt, config, time: new Date().toLocaleString() });
        while (history.length > 10) history.pop(); // 最多保存10条
        localStorage.setItem('game_history', JSON.stringify(history));
    } catch (e) { console.warn('保存历史失败', e); }
}

// 查看历史
window.showHistory = function() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch(e){}
    
    const list = $('history-list'); 
    if (!list) return;
    
    if (history.length === 0) {
        list.innerHTML = '<p style="color:#666;text-align:center;">暂无记录</p>';
    } else {
        list.innerHTML = history.map((item, idx) => `
            <div class="history-item" onclick="loadHistory(${idx})">
                <div style="font-weight:700;color:#00ffcc;">${item.config?.title || '未知游戏'}</div>
                <div style="font-size:12px;color:#aaa;margin-top:4px;">${item.prompt || ''}</div>
            </div>
        `).join('');
    }
    switchScreen('history-screen');
};

// 加载历史
window.loadHistory = function(idx) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch(e){}
    
    const item = history[idx]; 
    if(!item) return;
    
    if($('form-theme')) $('form-theme').value = item.config?.title || "重新生成"; 
    if($('form-enemyCount')) $('form-enemyCount').value = item.config?.enemies?.length || 10;
    if($('form-enemyHp')) $('form-enemyHp').value = item.config?.enemies?.[0]?.hp || 30;
    if($('form-story')) $('form-story').value = item.prompt || '';
    
    generateGame();
};
