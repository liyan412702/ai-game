export default async function onRequest({ request }) {
  const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  // 0. 环境变量检查：没配 key 直接报明确错误，不要让用户以为是"网络波动"
  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) {
    return jsonResponse({ error: '服务端未配置 DEEPSEEK_API_KEY，请联系管理员' }, 500);
  }

  try {
    const body = await request.json();
    // 1. 截断超长 prompt，防止刷 token
    const prompt = String(body.prompt || '默认射击游戏').slice(0, 2000);

    const controller = new AbortController();
    // 2. 超时放宽到 22s；请确保 EdgeOne 控制台里该函数超时 ≥ 30s，否则平台会先杀请求，catch 都跑不到
    const timeoutId = setTimeout(() => controller.abort(), 22000);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `你是顶级游戏总监。必须输出纯JSON（不要markdown代码块），字段如下：
{
  "title": "游戏名称",
  "design_thoughts": "一句话说明玩法设计核心",
  "bg_prompt": "英文背景提示词，横版游戏背景，宽银幕构图，不含任何文字",
  "player_prompt": "英文角色外观提示词，全身、居中、正面视角。严禁出现background/black/white/shadow等背景相关词，背景由前端统一处理",
  "enemy_prompt": "英文怪物外观提示词，全身、居中、正面视角。同样严禁出现任何背景相关词",
  "game_rules": {"win_condition": "kill_all", "player_speed": 6, "player_jump": -14, "enemy_hp": 30, "enemy_behavior": "walk"},
  "entities": []
}`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('DeepSeek HTTP', response.status, errText);
      return jsonResponse({ error: `大模型接口异常(${response.status})，请重试` }, 500);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    // 3. 空 content 判空
    if (!content) {
      console.error('DeepSeek 返回空 content', JSON.stringify(data).slice(0, 300));
      return jsonResponse({ error: 'AI 返回内容为空，请重试' }, 500);
    }

    // 4. strip markdown 包裹后解析
    const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON 解析失败', cleaned.slice(0, 300));
      return jsonResponse({ error: 'AI 输出格式异常，请重试' }, 500);
    }

    // 5. 关键字段兜底补齐，保证前端拿到的 config 一定能跑
    parsed.title = parsed.title || '未命名世界';
    parsed.design_thoughts = parsed.design_thoughts || 'AI 自动生成';
    parsed.bg_prompt = parsed.bg_prompt || 'sci-fi horizontal game background';
    parsed.player_prompt = parsed.player_prompt || 'cyberpunk hero, full body, front view';
    parsed.enemy_prompt = parsed.enemy_prompt || 'alien creature, full body, front view';
    parsed.game_rules = parsed.game_rules || {};
    parsed.game_rules.win_condition = parsed.game_rules.win_condition || 'kill_all';
    parsed.game_rules.player_speed = Number(parsed.game_rules.player_speed) || 6;
    parsed.game_rules.player_jump = Number(parsed.game_rules.player_jump) || -14;
    parsed.game_rules.enemy_hp = Number(parsed.game_rules.enemy_hp) || 30;
    parsed.game_rules.enemy_behavior = parsed.game_rules.enemy_behavior || 'walk';
    parsed.entities = Array.isArray(parsed.entities) ? parsed.entities : [];

    return jsonResponse(parsed);

  } catch (e) {
    console.error('generate 异常', e?.name, e?.message);

    // 6. 兜底：不返回 error 字段！否则前端 generateWorldConfig 里 `if (data.error) throw` 会把兜底丢掉
    return jsonResponse({
      fallback: true,
      fallback_reason: e?.name === 'AbortError' ? '生成超时' : '服务异常',
      title: '紧急迫降',
      design_thoughts: '系统检测到网络波动，已启用安全模式。',
      bg_prompt: 'sci-fi neon city horizontal game background, wide screen, no text',
      player_prompt: 'cyberpunk soldier, full body, front view, centered',
      enemy_prompt: 'alien monster, full body, front view, centered',
      game_rules: {
        win_condition: 'kill_all',
        player_speed: 6,
        player_jump: -14,
        enemy_hp: 30,
        enemy_behavior: 'walk'
      },
      entities: []
    }, 200);
  }
}
