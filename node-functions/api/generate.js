export default async function onRequest({ request }) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json();
    const prompt = body.prompt;
    if (!prompt) return new Response(JSON.stringify({ error: '缺少描述' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `你是一位世界顶级的游戏策划总监。你的任务是根据用户极其简单的描述，发挥你的想象力，自动扩写并生成一份有趣、丰富的游戏配置。

如果用户输入：
- "魂斗罗/射击/战斗"：你要自动脑补并设定较高的难度（敌人数量多、有BOSS），让 gameType 输出 "shooter"，enemyCount 设为 15-25，playerHp 设为 100。
- "塔防/防御"：你要脑补出怪物的波次，让 gameType 输出 "tower"，waves 设为 5-10，enemyHp 设为 50-150，coins 设为 200-400。
- "换装/穿衣"：你要脑补出赛博朋克、二次元或国风的色彩搭配，让 gameType 输出 "dressup"，并给出对应的 hex 颜色。
- "跑酷/躲避"：你要脑补出极速冲刺或极限跳跃的感觉，让 gameType 输出 "parkour"，speed 设为 15-22，density 设为 0.8-1.2。

必须只输出JSON，格式如下：
{
  "gameType": "parkour|tower|dressup|shooter",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "你作为策划给游戏起的酷炫名字",
  "speed": 14, "jumpForce": 9, "gravity": 26, "density": 0.7, "targetScore": 200,
  "waves": 5, "enemyHp": 100, "coins": 200,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00",
  "enemyCount": 10, "playerHp": 100
}
不要输出任何解释文字，只输出纯JSON。` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'DeepSeek调用失败', detail: err }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim() === '') return new Response(JSON.stringify({ error: 'AI返回空内容' }), { status: 502, headers: { 'Content-Type': 'application/json' } });

    const config = JSON.parse(content);
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
