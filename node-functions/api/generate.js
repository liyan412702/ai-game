export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  try {
    const { prompt } = await request.json();
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是一位顶级游戏总监（像宫本茂一样）。用户输入一句话，你必须设计出一个完整的“游戏机制”，而不仅仅是摆放积木。
            
必须输出纯 JSON，格式如下：
{
  "title": "游戏名称",
  "design_thoughts": "作为总监，一句话说明你的玩法设计核心",
  "bg_prompt": "画宏大背景的英文提示词",
  "player_prompt": "画主角立绘的英文提示词(纯黑底)",
  "enemy_prompt": "画怪物立绘的英文提示词(纯黑底)",
  "game_rules": {
    "win_condition": "kill_all", // 固定为杀光怪物通关
    "enemy_behavior": "chase",   // 固定为怪物追击玩家
    "player_hp": 100,
    "enemy_hp": 30
  },
  "entities": [
    {"type": "ground", "x": 400, "y": 580, "w": 800, "h": 40},
    {"type": "player", "x": 100, "y": 450, "w": 40, "h": 60},
    {"type": "enemy", "x": 600, "y": 450, "w": 40, "h": 40},
    {"type": "enemy", "x": 700, "y": 450, "w": 40, "h": 40}
  ]
}
请确保地面的 y 在 580 左右，玩家和怪物出生在 400-500 的空中。不要输出多余文字！` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return new Response(data.choices[0].message.content, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
