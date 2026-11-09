import { generateWorldConfig, requestZhipuImage, processImageRemoveBg } from './ai-service.js';
import { initEngine, stopGame, runGame } from './physics-engine.js';

const $ = (id) => document.getElementById(id);

try { initEngine(); } catch (e) { console.error('引擎初始化失败', e); }

let currentCategory = 'shooter';
let tempConfig = null;
let tempPlayerBase64 = null;
let tempEnemyBase64 = null;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  if (id) { const el = $(id); if (el) el.classList.add('active'); }
}
function showLoading(text) {
  const mask = $('loading-mask'); if (mask) mask.classList.add('show');
  const t = $('loading-text'); if (t) t.textContent = text || '处理中...';
}
function hideLoading() { const mask = $('loading-mask'); if (mask) mask.classList.remove('show'); }

window.openForm = function (type, title) {
  currentCategory = type || 'shooter';
  const t = $('form-title'); if (t) t.textContent = '定制 ' + (title || '');
  switchScreen('form-screen');
};

window.backToMenu = function () {
  switchScreen('menu-screen');
  try { stopGame(); } catch (e) { console.warn(e); }
  ['canvas2d', 'game-bg', 'controls', 'exit-btn', 'hud'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'none';
  });
};

window.generateGame = async function () {
  const theme = $('form-theme')?.value?.trim() || '赛博朋克霓虹都市';
  const enemyCount = Math.max(1, Math.min(50, parseInt($('form-enemyCount')?.value) || 10));
  const enemyHp = Math.max(1, Math.min(999, parseInt($('form-enemyHp')?.value) || 30));
  const story = $('form-story')?.value?.trim() || '魂斗罗式横版射击，消灭所有敌人';
  const prompt = `游戏分类：${currentCategory}。主题：${theme}。怪物数量：${enemyCount}。怪物血量：${enemyHp}。剧情：${story}`;

  switchScreen(null);
  showLoading('AI 推演玩法中...');

  try {
    // 1. 规则（失败直接抛出，因为后面全部依赖它）
    tempConfig = await generateWorldConfig(prompt);
    if (!tempConfig || typeof tempConfig !== 'object') throw new Error('AI 返回规则为空');
    tempConfig.user_enemyCount = enemyCount;
    if (!tempConfig.game_rules) tempConfig.game_rules = {};
    if (!tempConfig.game_rules.enemy_hp) tempConfig.game_rules.enemy_hp = enemyHp;
    if (!tempConfig.title) tempConfig.title = theme;

    // 2. 背景（失败不阻塞，降级渐变）
    showLoading('AI 绘制背景中...');
    const bgUrl = await requestZhipuImage(
      `${tempConfig.bg_prompt || theme}，横版游戏背景，宽银幕构图，无文字`
    ).catch(() => null);
    const previewImg = $('preview-img');
    const gameBg = $('game-bg');
    if (bgUrl) {
      if (previewImg) previewImg.src = bgUrl;
      if (gameBg) gameBg.style.backgroundImage = `url("${bgUrl}")`;
    } else {
      if (previewImg) previewImg.removeAttribute('src');
      if (gameBg) gameBg.style.background = 'linear-gradient(to bottom, #0f172a, #1e1b4b)';
    }

    // 3. 主角（失败不阻塞，引擎会降级画方块）
    showLoading('AI 绘制主角...');
    const pUrl = await requestZhipuImage(
      `${tempConfig.player_prompt || '赛博朋克战士'}，游戏角色立绘，全身，居中，纯白色纯色背景，无文字，无阴影，正面视角`
    ).catch(() => null);
    tempPlayerBase64 = await processImageRemoveBg(pUrl).catch(() => null);

    // 4. 敌人
    showLoading('AI 绘制怪物...');
    const eUrl = await requestZhipuImage(
      `${tempConfig.enemy_prompt || '赛博朋克怪物'}，游戏敌人立绘，全身，居中，纯白色纯色背景，无文字，无阴影，正面视角`
    ).catch(() => null);
    tempEnemyBase64 = await processImageRemoveBg(eUrl).catch(() => null);

    const thoughts = $('preview-thoughts');
    if (thoughts) thoughts.textContent = '💡 主策推演: ' + (tempConfig.design_thoughts || '（无）');

    switchScreen('preview-screen');
    saveHistory(prompt, tempConfig);
  } catch (e) {
    console.error(e);
    alert('生成失败: ' + (e?.message || e));
    backToMenu();
  } finally {
    hideLoading();
  }
};

window.startPlay = function () {
  if (!tempConfig) { alert('还没有生成游戏'); return; }
  switchScreen(null);
  ['canvas2d', 'game-bg', 'exit-btn', 'hud'].forEach(id => {
    const el = $(id); if (el) el.style.display = 'block';
  });
  const ctr = $('controls'); if (ctr) ctr.style.display = 'flex';
  const title = $('hud-title'); if (title) title.textContent = tempConfig.title || 'AI 游戏';
  const enemyLbl = $('hud-enemy'); if (enemyLbl) enemyLbl.textContent = '敌人剩余: ' + (tempConfig.user_enemyCount || 0);

  try {
    runGame(tempConfig, tempPlayerBase64, tempEnemyBase64);
  } catch (e) {
    console.error(e);
    alert('启动失败: ' + (e?.message || e));
    backToMenu();
  }
};

function saveHistory(prompt, config) {
  try {
    const history = JSON.parse(localStorage.getItem('game_history') || '[]');
    history.unshift({ prompt, config, time: new Date().toLocaleString() });
    while (history.length > 10) history.pop();
    localStorage.setItem('game_history', JSON.stringify(history));
  } catch (e) { console.warn('保存历史失败', e); }
}

window.showHistory = function () {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch (e) {}
  const list = $('history-list');
  if (!list) return;
  if (!history.length) {
    list.innerHTML = '<p style="color:#666;text-align:center;">暂无记录</p>';
  } else {
    list.innerHTML = history.map((item, idx) => {
      const title = escapeHtml(item?.config?.title || '未命名');
      const p = escapeHtml(item?.prompt || '');
      return `<div class="history-item" onclick="loadHistory(${idx})">
        <div style="font-weight:700;color:#00ffcc;">${title}</div>
        <div style="font-size:12px;color:#aaa;margin-top:4px;">${p}</div>
      </div>`;
    }).join('');
  }
  switchScreen('history-screen');
};

window.loadHistory = function (idx) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem('game_history') || '[]'); } catch (e) {}
  const item = history[idx];
  if (!item) return;
  const themeInput = $('form-theme');
  const countInput = $('form-enemyCount');
  const hpInput = $('form-enemyHp');
  const storyInput = $('form-story');
  if (themeInput) themeInput.value = item.config?.title || '重新生成';
  if (countInput) countInput.value = item.config?.user_enemyCount || 10;
  if (hpInput) hpInput.value = item.config?.game_rules?.enemy_hp || 30;
  if (storyInput) storyInput.value = item.prompt || '';
  generateGame();
};
