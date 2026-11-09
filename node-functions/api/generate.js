export default async function onRequest({ request }) {
  // 确保返回的永远是 JSON
  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  };

  if (request.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    const body = await request.json();
    const prompt = body.prompt || '默认射击游戏';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒强制超时熔断

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `你是顶级游戏总监。必须输出纯JSON：
{
  "title": "游戏名称",
  "design_thoughts": "一句话说明玩法设计核心",
  "bg_prompt": "画背景的英文提示词",
  "player_prompt": "画主角的英文提示词(纯黑底)",
  "enemy_prompt": "画怪物的英文提示词(纯黑底)",
  "game_rules": {"win_condition": "kill_all", "player_speed": 6, "enemy_hp": 30},
  "entities": [{"type": "ground", "x": 400, "y": 580, "w": 800, "h": 40}, {"type": "player", "x": 100, "y": 450, "w": 40, "h": 60}, {"type": "enemy", "x": 600, "y": 450, "w": 40, "h": 40}]
}` 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
        return jsonResponse({ error: "大模型接口拥堵，请重试" }, 500);
    }

    const data = await response.json();
    return jsonResponse(data.choices[0].message.content ? JSON.parse(data.choices[0].message.content) : { error: "AI解析失败" });
    
  } catch (e) {
    // 任何报错，兜底给一个能玩的默认配置，绝不返回 500 HTML
    return jsonResponse({ 
        error: "生成超时，已启用兜底配置",
        title: "紧急迫降",
        design_thoughts: "系统检测到网络波动，启用了安全模式。",
        bg_prompt: "sci-fi background",
        player_prompt: "cyberpunk soldier, black background",
        enemy_prompt: "alien monster, black background",
        game_rules: { win_condition: 'kill_all', player_speed: 6, enemy_hp: 30 },
        entities: []
    }, 200); 
  }
}
