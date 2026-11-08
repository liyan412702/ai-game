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
          { role: 'system', content: `你是一位硬核游戏策划。用户会输入一句话，你必须自动扩写参数，绝不能只改名字！
要求：
1. 如果涉及"魂斗罗"或"射击"：gameType必须为"shooter"，enemyCount必须在15到30之间，playerHp设为100。
2. 如果涉及"塔防"：gameType必须为"tower"，waves在5到10之间，enemyHp在100到200之间。
3. 如果涉及"跑酷"：gameType必须为"parkour"，speed在18到25之间（速度极快）。
4. 如果涉及"换装"：gameType必须为"dressup"。
输出纯JSON：
{
  "gameType": "shooter|tower|parkour|dressup",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "根据描述起个酷炫的名字",
  "speed": 14, "jumpForce": 9, "gravity": 26, "density": 0.7, "targetScore": 200,
  "waves": 5, "enemyHp": 100, "coins": 200,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00",
  "enemyCount": 10, "playerHp": 100
}` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.8
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
