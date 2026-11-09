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
            content: `你是一位“游戏沙盒架构师”。用户会提出需求，你不必写代码，而是根据需求设计一个物理世界的实体布局。
必须输出纯JSON，格式如下：
{
  "title": "游戏名称",
  "design_thoughts": "一句话描述你的物理世界设计理念",
  "bg_prompt": "画一张宏大背景的英文提示词",
  "player_prompt": "画一个主角立绘的英文提示词(纯黑底)",
  "enemy_prompt": "画一个怪物立绘的英文提示词(纯黑底)",
  "entities": [
    // 必须包含地面。x,y是坐标，w,h是宽高。
    {"type": "ground", "x": 400, "y": 580, "w": 800, "h": 40},
    {"type": "player", "x": 100, "y": 450, "w": 40, "h": 60},
    // 根据用户需求生成怪物或障碍物
    {"type": "enemy", "x": 600, "y": 450, "w": 40, "h": 40},
    {"type": "enemy", "x": 700, "y": 450, "w": 40, "h": 40},
    // 如果用户要塔防，生成 "tower"；要跑酷，生成 "obstacle"
    {"type": "obstacle", "x": 300, "y": 500, "w": 50, "h": 80}
  ]
}
要求：坐标在 0-800 宽度，0-600 高度之间。玩家必须出生在地面附近。严格只输出 JSON！` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const config = JSON.parse(data.choices[0].message.content);
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
