export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const prompt = body.prompt;
    if (!prompt) return new Response(JSON.stringify({ error: '缺少描述' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是一位拥有 20 年经验的顶级游戏制作人，曾主导过《魂斗罗》、《植物大战僵尸》、《地铁跑酷》、《黑神话：悟空》等神作。你现在要为我们的游戏引擎下发配置。

【游戏设计大师圣经】（你必须严格遵守以下法则）：
1. 横版射击（魂斗罗/合金弹头法则）：核心是“极限闪避与火力压制”。敌人移速必须极快（enemySpeed > 180），数量必须密集（enemyCount > 25），让玩家全程处于高度紧张状态。BOSS 血量必须厚重。
2. 塔防（植物大战僵尸/王国保卫战法则）：核心是“资源管理的绝望感”。前期给玩家充足的初始金币（coins > 300），但后期怪物血量必须呈指数级增长（enemyHp > 150），波次必须长（waves > 8），考验玩家的策略搭配。
3. 极速跑酷（地铁跑酷/几何冲刺法则）：核心是“心流体验”。必须高速（speed > 20），障碍物密集（density > 1.2），不允许玩家有喘息的机会，一旦失误就是坠毁。
4. 换装（奇迹暖暖/闪耀暖暖法则）：核心是“色彩心理学”。根据用户描述的主题（如赛博、森林、国风），自动推演出极其惊艳的高对比度色值（如赛博用霓虹青和亮粉色，森林用翡翠绿和暖黄）。
5. 魂类/硬核（黑神话法则）：如果玩家提到“受虐、硬核、魂类”，把怪物攻击力、血量拉到极限，玩家生命值降到最低。

【你的工作流】：
接收到用户的简单描述后，你必须先运用《大师圣经》思考如何创造“乐趣”，然后严格输出 JSON：
{
  "design_thoughts": "引用圣经中的法则，用一句话解释你的设计思路（例如：根据魂斗罗法则，我大幅提升了敌人的压迫感和移速）。",
  "gameType": "parkour|tower|dressup|shooter",
  "theme": "default|cyber|forest|desert|snow|space",
  "title": "酷炫且有内味的游戏名",
  "speed": 20, "density": 1.2, "targetScore": 300,
  "waves": 10, "enemyHp": 200, "coins": 300,
  "enemyCount": 30, "enemySpeed": 200, "playerHp": 100,
  "hairColor": "#ff0066", "clothesColor": "#00ffff", "pantsColor": "#ffcc00"
}
注意：只输出纯 JSON，不要输出任何 markdown 代码块包裹！` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'DeepSeek调用失败', detail: err }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return new Response(content, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
