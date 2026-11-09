// 专门负责请求后端生成蓝图
export async function generateWorldConfig(story) {
    try {
        const res = await fetch('/api/generate', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ prompt: story }) 
        });
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("云端服务器返回异常。");
        }

        const data = await res.json();
        if (data.error && !data.title) throw new Error(data.error);
        return data;
    } catch(e) {
        throw new Error("生成失败：" + e.message);
    }
}
