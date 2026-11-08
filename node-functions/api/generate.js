export default async function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  try {
    const { prompt, zhipuKey } = await request.json();
    
    // 1. 生成配置
    const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `你是顶级游戏主策。写一句极具视觉冲击力的英文绘画提示词填入 image_prompt。输出纯JSON：{"design_thoughts":"文案","image_prompt":"epic cyberpunk soldier","gameType":"shooter","title":"游戏名","enemyCount":20,"enemyHp":25,"enemySpeed":150,"playerHp":100}` },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    const config = JSON.parse((await dsRes.json()).choices[0].message.content);

    // 2. 代理调用智谱生图并转 Base64（防止跨域）
    const getBase64Image = async (imgPrompt) => {
        try {
            const zRes = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${zhipuKey}` },
                body: JSON.stringify({ model: 'cogview-3-flash', prompt: imgPrompt, size: '1024x1024' })
            });
            const zData = await zRes.json();
            if (!zData.data || !zData.data[0]) return null;
            
            const imgRes = await fetch(zData.data[0].url);
            const buffer = await imgRes.arrayBuffer();
            // 安全转 Base64，防止爆栈
            const binary = new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), '');
            return `data:image/jpeg;base64,${btoa(binary)}`;
        } catch (e) { return null; }
    };

    // 3. 依次生成三种资产
    config.image_url = await getBase64Image(`epic wide background, ${config.image_prompt}`);
    config.player_url = await getBase64Image(`game character sprite, full body, solid black background, glowing neon, ${config.image_prompt.split(',')[0]}`);
    config.enemy_url = await getBase64Image(`game enemy monster sprite, solid black background, glowing neon alien`);

    return new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
