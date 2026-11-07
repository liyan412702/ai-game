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
          { role: 'system', content: `你是一个多类型游戏配置生成器。请根据用户的描述判断游戏类型。
1. 跑酷/躲避：gameType="parkour"
2. 塔防/防御：gameType="tower"
3. 换装/穿衣：gameType="dressup"
4. 射击/魂斗罗/枪战：gameType="shooter"

必须只输出JSON，格式如下（不适用的填默认值）：
{
  "gameType": "parkour|tower|dressup|shooter",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "游戏名",
  "speed": 14, "jumpForce": 9, "gravity": 26, "density": 0.7, "targetScore": 200,
  "waves": 5, "enemyHp": 100, "coins": 200,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00",
  "enemyCount": 10, "playerHp": 100
}
不要输出任何解释文字。` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.3
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
