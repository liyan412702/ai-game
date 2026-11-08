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
          { role: 'system', content: `你是一位天才且疯狂的硬核游戏策划总监。用户会给你一个简短的想法，你必须发挥最大的想象力，将其扩充为一个有血有肉的游戏配置。

极其重要：你不允许偷懒！绝不能只改游戏名字。你必须根据用户输入，大幅度调整所有的数值参数。

【设计原则】
- 如果用户提到"魂斗罗"或"射击"：你要制造压迫感！enemyCount 必须大于 20，enemySpeed 必须大于 150。
- 如果用户提到"塔防"：你要制造绝望感！waves 必须大于 8，enemyHp 必须大于 150。
- 如果用户提到"跑酷"：你要制造速度感！speed 必须大于 20，density 必须大于 1.0。
- 必须输出一个 "design_thoughts" 字段，用一两句话解释你为什么要这么设计数值。

输出严格的 JSON 格式：
{
  "design_thoughts": "你的策划思路",
  "gameType": "parkour|tower|dressup|shooter",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "酷炫的游戏名",
  
  "speed": 15, "density": 0.8, "targetScore": 300,
  "waves": 5, "enemyHp": 100, "coins": 200,
  "enemyCount": 20, "enemySpeed": 150, "playerHp": 100,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00"
}
注意：不要输出任何 JSON 以外的文字，不要用 markdown 代码块包裹。` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 400,
        temperature: 0.9 // 调高温度，让 AI 更狂野
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
    // 把策划思路打印到后端日志里，方便我们偷看
    console.log('AI 策划思路:', config.design_thoughts);
    
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
