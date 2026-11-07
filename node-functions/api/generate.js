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
          { role: 'system', content: `你是一个游戏配置生成器。请根据用户的描述，判断他们想要的游戏类型。
提到跑酷、躲避、跳跃等，gameType 输出 "parkour"。
提到塔防、防御、建塔等，gameType 输出 "tower"。
必须只输出JSON，格式如下：
{
  "gameType": "parkour" 或 "tower",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "游戏中文名",
  "speed": 8-22 (跑酷速度),
  "jumpForce": 8-12 (跑酷跳跃力),
  "gravity": 22-30 (跑酷重力),
  "density": 0.3-1.2 (跑酷障碍密度),
  "targetScore": 100-300 (跑酷目标分数),
  "waves": 3-10 (塔防波数),
  "enemyHp": 50-200 (塔防怪物血量),
  "coins": 100-500 (塔防初始金币)
}
根据描述调整参数：赛博/霓虹/未来→cyber；森林/自然→forest；沙漠→desert；雪/冰→snow；太空/宇宙→space。不要输出任何解释文字。` },
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
