export default async function onRequest({ request }) {
  const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) return jsonResponse({ error: '服务端未配置 DEEPSEEK_API_KEY' }, 500);

  try {
    const body = await request.json();
    const prompt = String(body.prompt || '赛博朋克横版射击').slice(0, 2000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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
            content: `你是一个顶级2D游戏关卡设计师。请根据用户需求，输出纯JSON（不要markdown），严格按照以下结构生成数据：
{
  "title": "游戏名称",
  "design_thoughts": "一句话说明玩法设计",
  "bg_prompt": "横版游戏背景英文提示词，宽银幕",
  "player_prompt": "游戏主角外观英文提示词",
  "enemy_prompt": "游戏怪物外观英文提示词",
  "map": { "width": 3000, "height": 800 },
  "player": { "x": 100, "y": 500, "width": 40, "height": 60, "speed": 6, "hp": 100 },
  "platforms": [
    { "x": 0, "y": 700, "width": 3000, "height": 100 }
  ],
  "enemies": [
    { "x": 800, "y": 600, "width": 40, "height": 40, "hp": 30, "behavior": "patrol", "speed": 4, "attack": "melee", "attack_rate": 2 }
  ]
}
规则（务必遵守，否则玩家无法通关）：
1. behavior 选："patrol", "chase", "fly_sine"。attack 选："melee", "shoot", "none"。
2. 如果生成悬空平台，【相邻平台的高度差绝对不能超过 80 像素】，否则玩家跳不上去！
3. 务必保证玩家(100, 500)和敌人出生在平台上方，不要卡在平台里面。
4. 地图必须有一条位于最底部的长地面，防止玩家掉出宇宙。`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('返回为空');

    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    
    if(!parsed.map) parsed.map = { width: 3000, height: 800 };
    if(!parsed.platforms) parsed.platforms = [{ x: 0, y: parsed.map.height - 50, width: parsed.map.width, height: 50 }];
    
    return jsonResponse(parsed);

  } catch (e) {
    console.error('generate error', e);
    return jsonResponse({
      fallback: true, fallback_reason: '网络波动，已启用安全模式',
      title: "紧急迫降", design_thoughts: "测试关卡",
      bg_prompt: "sci-fi background", player_prompt: "cyberpunk soldier", enemy_prompt: "alien",
      map: { width: 2000, height: 800 },
      player: { x: 100, y: 400, width: 40, height: 60, speed: 6, hp: 100 },
      platforms: [{ x: 0, y: 700, width: 2000, height: 100 }],
      enemies: [{ x: 800, y: 600, width: 40, height: 40, hp: 30, behavior: "chase", speed: 3, attack: "melee", attack_rate: 1 }]
    }, 200);
  }
}
