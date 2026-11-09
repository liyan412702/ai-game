export default async function onRequest({ request }) {
  const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    const body = await request.json();
    const prompt = body.prompt || '默认世界';
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是顶级游戏制作人。现在，你不写代码，也不分游戏类型，而是直接设计一个“通用物理世界蓝图”。
根据用户的需求，你可以设计任何玩法（射击、塔防、平台跳跃、大逃杀等）。

【世界蓝图规则】：
1. 必须包含地面（platform）。
2. 必须包含主角（player）。
3. 根据需求，生成敌人（enemy_chase 陆地追击，enemy_fly 空中浮动）。
4. 如果用户要收集或塔防，生成静态金币（coin）或防御塔（tower）。
5. 你的设计思路（design_thoughts）必须解释你安排了什么机制。

输出纯 JSON，格式如下：
{
  "title": "游戏名称",
  "design_thoughts": "我为你设计的机制是...",
  "theme": "cyber", // 只能是 cyber(霓虹赛博), forest(丛林), space(太空)
  "camera_follow": true, // 相机是否跟随主角
  "gravity": 1, // 世界重力
  "entities": [
    {"type": "platform", "x": 400, "y": 580, "w": 800, "h": 40},
    {"type": "player", "x": 100, "y": 450, "w": 40, "h": 60},
    {"type": "enemy_chase", "x": 600, "y": 500, "w": 40, "h": 40},
    {"type": "enemy_fly", "x": 700, "y": 300, "w": 40, "h": 40},
    {"type": "coin", "x": 300, "y": 400, "w": 20, "h": 20}
  ]
}
请确保坐标尽量合理，玩家和怪物不要重叠。不要输出多余文字！` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return jsonResponse(JSON.parse(data.choices[0].message.content));
  } catch (e) {
    // 终极兜底：如果 AI 挂了，强行返回一个默认射击世界，保证能玩！
    return jsonResponse({ 
        title: "紧急迫降", design_thoughts: "大模型拥堵，已启动内置测试关卡。", 
        theme: "cyber", camera_follow: true, gravity: 1,
        entities: [
            {"type": "platform", "x": 400, "y": 580, "w": 800, "h": 40},
            {"type": "player", "x": 100, "y": 450, "w": 40, "h": 60},
            {"type": "enemy_chase", "x": 600, "y": 500, "w": 40, "h": 40},
            {"type": "enemy_chase", "x": 700, "y": 500, "w": 40, "h": 40},
            {"type": "coin", "x": 300, "y": 400, "w": 20, "h": 20}
        ]
    });
  }
}
