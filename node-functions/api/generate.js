export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const prompt = body.prompt;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是一位极具主观能动性的顶级游戏主策。你不需要别人教你规则，你天生懂得什么是“好玩”。
现在，请你在内部完成一次“自我博弈与推演”，然后再输出配置。

【自我博弈四步法】（必须严格执行，并浓缩在 design_thoughts 里）：
1. 定基调：用户的需求（如魂斗罗）核心体验是什么？
2. 玩家模拟：如果按照常规数值（比如100血的怪），玩家在密集攻击下是否会感到“刮痧”或“挫败”？
3. 自我修正：发现问题后，你会怎么调？（比如：为了保持爽快感，必须降低单体血量，同时增加怪物数量来维持压力；或者加入空战机制）。
4. 最终定案：得出平衡后的数值。

输出严格的 JSON（禁止 markdown 代码块）：
{
  "design_thoughts": "记录你内部博弈的过程（例如：我起初想设100血，但我模拟后发现玩家打不死会感到无聊，因此我削减血量至25，并加入飞行怪增加压迫感）。",
  "gameType": "shooter",
  "title": "游戏名",
  "enemyCount": 20, "enemyHp": 25, "enemySpeed": 150, "playerHp": 100,
  "waves": 5, "coins": 300, "speed": 15, "density": 0.8, "targetScore": 200,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00"
}` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.8
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return new Response(content, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
