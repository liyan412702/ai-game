export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  try {
    const { prompt } = await request.json();
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `你是顶级游戏主策。写一句极具视觉冲击力的英文绘画提示词填入 image_prompt。输出纯JSON：{"design_thoughts":"文案","image_prompt":"epic cyberpunk soldier, neon lights, solid background","gameType":"shooter","title":"游戏名","enemyCount":20,"enemyHp":25,"enemySpeed":150,"playerHp":100}` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const config = JSON.parse(data.choices[0].message.content);
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
