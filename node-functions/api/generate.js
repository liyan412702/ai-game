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
          { role: 'system', content: `你是一个多类型游戏配置生成器。请根据用户的描述，判断他们想要的游戏类型。
1. 提到跑酷、躲避、跳跃等，gameType 输出 "parkour"。
2. 提到塔防、防御、建塔等，gameType 输出 "tower"。
3. 提到换装、穿搭、衣服、打扮等，gameType 输出 "dressup"。

必须只输出JSON，格式如下（如果某些参数不适用，填入默认值即可）：
{
  "gameType": "parkour" 或 "tower" 或 "dressup",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "游戏中文名",
  "speed": 14, "jumpForce": 9, "gravity": 26, "density": 0.7, "targetScore": 200,
  "waves": 5, "enemyHp": 100, "coins": 200,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00"
}

根据描述调整参数：
- 赛博/霓虹→cyber，并用青/粉/紫作为换装颜色。
- 森林/自然→forest，并用绿/棕/黄作为换装颜色。
- 太空→space，并用深蓝/银/紫作为换装颜色。
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
    if (!content || content.trim() === '') return new Response(JSON.stringify({ error: 'AI返回空内容，请重试' }), { status: 502, headers: { 'Content-Type': 'application/json' } });

    const config = JSON.parse(content);
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
