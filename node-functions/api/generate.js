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
            content: `你是拥有20年经验的顶级游戏制作人（类似小岛秀夫、宫本茂）。你精通各种游戏机制。
用户输入需求后，你必须执行以下三步“自我推演”，然后再输出配置：

【第一步：对标检索】在脑海中检索经典游戏（如魂斗罗、吸血鬼幸存者、马里奥、塔防），提取它们的核心机制。
【第二步：玩法设计】基于用户需求，设计一个真正好玩的机制（比如：是杀光所有敌人？还是收集特定物品？或者存活指定时间？必须包含击杀反馈或特殊机制）。
【第三步：生成蓝图】将你的设计转化为物理引擎可以理解的实体列表。

输出严格的 JSON（禁止 markdown 代码块）：
{
  "title": "游戏名称",
  "design_thoughts": "如实写下你的【对标检索】与【玩法设计】的推演过程，字数在100字左右。",
  "bg_prompt": "宏大背景的英文提示词",
  "player_prompt": "主角立绘的英文提示词(纯黑底)",
  "enemy_prompt": "怪物立绘的英文提示词(纯黑底)",
  "game_rules": {
    "win_condition": "kill_all | survive_time | collect_coins",
    "target_value": 100, 
    "enemy_behavior": "chase | patrol | fly",
    "player_speed": 6,
    "player_jump": -14,
    "enemy_hp": 30,
    "enemy_damage": 10
  },
  "entities": [
    // 必须包含 type: "ground", "player", "enemy", "coin", "obstacle" 的实体
    // 这里不要给绝对坐标了，给个大概的相对位置即可，前端会自动排版
    {"type": "ground", "x": 400, "y": 580, "w": 800, "h": 40},
    {"type": "player", "x": 100, "y": 450, "w": 40, "h": 60},
    {"type": "enemy", "x": 600, "y": 450, "w": 40, "h": 40}
  ]
}
注意：只输出纯 JSON！` 
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
