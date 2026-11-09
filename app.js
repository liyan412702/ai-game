import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

initEngine();

const menuScreen = document.getElementById('menu-screen');
const formScreen = document.getElementById('form-screen');
const loadingMask = document.getElementById('loading-mask');
const loadingText = document.getElementById('loading-text');
const gameBg = document.getElementById('game-bg');
const canvas = document.getElementById('canvas2d');

window.openForm = function() {
    menuScreen.classList.remove('active');
    formScreen.classList.add('active');
};

window.backToMenu = function() {
    menuScreen.classList.add('active');
    formScreen.classList.remove('active');
    gameBg.style.display = 'none';
    canvas.style.display = 'none';
    document.getElementById('controls').style.display = 'none';
    document.getElementById('exit-btn').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('ai-thoughts').style.display = 'none';
    stopGame();
};

window.generateGame = async function() {
    const story = document.getElementById('form-story').value || '生成一个赛博朋克平地，有主角和怪物';
    formScreen.classList.remove('active');
    loadingMask.classList.add('show');
    
    try {
        // 1. 拿数据
        const config = await generateWorldConfig(story);

        // 2. 拿图片
        loadingText.textContent = 'AI 生成世界背景中...';
        let bgUrl = await requestZhipuImage(config.bg_prompt);
        if (bgUrl) gameBg.style.backgroundImage = `url(${bgUrl})`;

        loadingText.textContent = 'AI 生成主角实体中...';
        let pUrl = await requestZhipuImage(config.player_prompt);
        let playerBase64 = await processImageRemoveBg(pUrl);

        loadingText.textContent = 'AI 生成怪物实体中...';
        let eUrl = await requestZhipuImage(config.enemy_prompt);
        let enemyBase64 = await processImageRemoveBg(eUrl);

        // 3. 启动引擎
        canvas.style.display = 'block';
        document.getElementById('controls').style.display = 'flex';
        document.getElementById('exit-btn').style.display = 'block';
        document.getElementById('hud').style.display = 'block';
        gameBg.style.display = 'block';
        document.getElementById('hud-title').textContent = config.title || '物理世界';
        document.getElementById('ai-thoughts').textContent = "💡 架构师: " + config.design_thoughts; 
        document.getElementById('ai-thoughts').style.display = 'block'; 

        runGame(config, playerBase64, enemyBase64);

    } catch(e) { 
        console.error(e);
        alert('生成遇到问题: ' + e.message); 
        window.backToMenu();
    } finally {
        loadingMask.classList.remove('show');
    }
};
