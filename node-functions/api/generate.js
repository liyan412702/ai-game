export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await request.json();
    const prompt = body.prompt || '跑酷';

    // 1. 呼叫 DeepSeek 生成配置与美术提示词
    const dsResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是一位顶级游戏主策。请完成内部博弈，输出配置。
【美术提示词】：根据用户需求，写一句极具视觉冲击力的英文绘画提示词，填入 image_prompt 字段。必须用英文！
输出严格的 JSON：
{
  "design_thoughts": "内部博弈过程(30字内)",
  "image_prompt": "epic game cover art",
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
    let image_data = null;
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
      const imageUrl = zhipuData.data?.[0]?.url;
      
      if (imageUrl) {
        // 【核心修复】：避免大字符串爆栈，使用安全的转换方式
        try {
          const imgRes = await fetch(imageUrl);
          const buffer = await imgRes.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          image_data = `data:image/jpeg;base64,${btoa(binary)}`;
          debug_msg = "绘图成功";
        } catch (err) {
          debug_msg = "转码失败,直接用URL";
          image_data = imageUrl; // 降级方案：如果转码失败，直接把外部链接给前端
        }
      } else {
        debug_msg = "接口没返回图片";
      }
    } catch (err) {
      debug_msg = "智谱报错:" + err.message;
    }

    // 把图片结果和调试信息一起返回
    config.image_base64 = image_data;
    config.design_thoughts += " | 画师状态: " + debug_msg;
    
    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
