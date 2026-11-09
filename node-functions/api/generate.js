export default async function onRequest({ request }) {
  const jsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) {
    return jsonResponse({ error: '服务端未配置 DEEPSEEK_API_KEY' }, 500);
  }

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
  "map": { "width": 3000, "height": 800, "gravity": 1.2 },
  "player": { "x": 100, "y": 500, "width": 40, "height": 60, "speed": 6, "jump": -15, "hp": 100 },
  "platforms": [
    { "x": 0, "y": 700, "width": 3000, "height": 100 }
  ],
  "enemies": [
    {
      "x": 800, "y": 600, "width": 40, "height": 40, "hp": 30,
      "behavior": "patrol", 
      "speed": 4,
      "attack": "melee",
      "attack_rate": 2
    }
  ],
  "win_condition": { "type": "kill_all" }
}
规则：
1. behavior 只能选："patrol"(巡逻), "chase"(追击), "fly_sine"(正弦飞行)。
2. attack 只能选："melee"(近战触碰伤害), "shoot"(发射子弹), "none"(无攻击)。
3. 如果生成平台跳跃游戏，请添加多个悬空平台到 platforms 数组里。
4. 平台坐标以大地图左上角为原点。务必保证玩家和敌人出生在平台上方。`
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
    
    // 确保关键字段存在
    if(!parsed.map) parsed.map = { width: 3000, height: 800, gravity: 1 };
    if(!parsed.platforms) parsed.platforms = [{ x: 0, y: parsed.map.height - 50, width: parsed.map.width, height: 50 }];
    
    return jsonResponse(parsed);

  } catch (e) {
    console.error('generate error', e);
    // 兜底配置：一个绝对能跑的简易跳跃测试
    return jsonResponse({
      fallback: true, fallback_reason: '网络波动，已启用安全模式',
      title: "紧急迫降", design_thoughts: "测试关卡",
      bg_prompt: "sci-fi background", player_prompt: "cyberpunk soldier", enemy_prompt: "alien",
      map: { width: 2000, height: 800, gravity: 1.2 },
      player: { x: 100, y: 400, width: 40, height: 60, speed: 6, jump: -15, hp: 100 },
      platforms: [{ x: 0, y: 700, width: 2000, height: 100 }],
      enemies: [{ x: 800, y: 600, width: 40, height: 40, hp: 30, behavior: "chase", speed: 3, attack: "melee", attack_rate: 1 }],
      win_condition: { type: "kill_all" }
    }, 200);
  }
}
