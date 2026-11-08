export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  
  try {
    const body = await request.json();
    const prompt = body.prompt || '赛博朋克魂斗罗';

    // 1. 呼叫 DeepSeek 生成配置
    const dsResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是顶级游戏主策。请完成内部博弈，输出配置。
【美术提示词】：根据用户需求，写一句极具视觉冲击力的英文绘画提示词，填入 image_prompt 字段。必须用英文！
输出严格的 JSON：
{
  "design_thoughts": "内部博弈过程(30字内)",
  "image_prompt": "epic cyberpunk soldier, neon lights, game cover art",
  "gameType": "shooter",
  "title": "游戏名",
  "enemyCount": 20, "enemyHp": 25, "enemySpeed": 150, "playerHp": 100
}` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const dsData = await dsResponse.json();
    const config = JSON.parse(dsData.choices?.[0]?.message?.content);

    // 2. 呼叫智谱 CogView-3-Flash
    let image_url = null;
    let debug_msg = "";
    try {
      const zhipuResponse = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}` },
        body: JSON.stringify({
          model: 'cogview-3-flash',
          prompt: config.image_prompt || 'epic game art',
          size: '1024x1024'
        })
      });
      
      const zhipuData = await zhipuResponse.json();
      image_url = zhipuData.data?.[0]?.url;
      
      if (image_url) {
        debug_msg = "画师绘图成功";
      } else {
        debug_msg = "接口没返回图片: " + JSON.stringify(zhipuData);
      }
    } catch (err) {
      debug_msg = "画师报错:" + err.message;
    }

    // 直接把智谱的图片外链返回给前端
    config.image_url = image_url;
    config.design_thoughts += " | " + debug_msg;
    
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    // 【关键修复】如果服务器内部出错，必须返回 JSON 格式，否则前端就会报 Unexpected token '<'
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
