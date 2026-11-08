export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const prompt = body.prompt || '跑酷';

    // 1. 呼叫 DeepSeek 生成游戏配置与美术提示词
    const dsResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是一位懂“动态平衡”的顶级游戏主策，同时具备极高的美术审美。请完成内部博弈，并输出配置。
【自我博弈】：先模拟玩家体验，再定数值。
【美术提示词】：根据用户需求，写一句极具视觉冲击力的英文绘画提示词（如：cyberpunk soldier, neon lights, epic, high quality, game cover art），填入 image_prompt 字段。绝对不要包含文字！必须用英文！
输出严格的 JSON（禁止 markdown 代码块）：
{
  "design_thoughts": "内部博弈过程(50字内)",
  "image_prompt": "英文绘画提示词",
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

    const dsData = await dsResponse.json();
    const config = JSON.parse(dsData.choices?.[0]?.message?.content);

    // 2. 呼叫智谱 CogView-3-Flash 生成图片
    let image_base64 = null;
    try {
      const zhipuResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}` },
        body: JSON.stringify({
          model: 'cogview-3-flash',
          prompt: config.image_prompt || 'epic game cover art, neon lights',
          size: '1024x1024'
        })
      });
      
      const zhipuData = await zhipuResponse.json();
      const imageUrl = zhipuData.data?.[0]?.url;
      
      // 3. 将图片 URL 下载并转为 Base64，彻底解决前端跨域问题
      if (imageUrl) {
        const imgRes = await fetch(imageUrl);
        const buffer = await imgRes.arrayBuffer();
        // 在 Workers 环境下用 Base64 编码
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        image_base64 = `data:image/png;base64,${base64}`;
      }
    } catch (err) {
      console.error('生图失败，但不影响游戏运行', err);
    }

    // 将图片和配置一起返回给前端
    config.image_base64 = image_base64;
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
