// ⚠️ 安全提醒：ZHIPU_KEY 绝不能长期放前端，建议下一版改成走后端 /api/image 代理。
const ZHIPU_KEY = '0872c4e54b384de19de2081c4d87e7f0.wqkFwvMWAQfbrLpz';

export async function generateWorldConfig(story) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: story })
  });
  if (!res.ok) throw new Error('规则接口 HTTP ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function requestZhipuImage(prompt) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
      body: JSON.stringify({ model: 'cogview-3-flash', prompt: String(prompt || ''), size: '1024x1024' }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data?.[0]?.url) || null;
  } catch (e) {
    console.warn('生图失败', e);
    return null;
  }
}

/**
 * 改进版抠图：
 *  - 取四角平均色作为背景色，只删除"接近背景色"的像素（不再误伤暗色角色）
 *  - 四角颜色差异过大（背景复杂）→ 放弃抠图，直接回退原图，避免"隐身"
 *  - 边缘做羽化，避免锯齿
 *  - 输出缩放到 ≤256，减小 dataURL 与绘制开销
 *  - 10s 超时回退原图
 */
export async function processImageRemoveBg(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl; // 已经是 dataURL

  const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=png`;

  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => { if (done) return; done = true; clearTimeout(timer); resolve(val); };
    const timer = setTimeout(() => finish(imageUrl), 10000);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return finish(imageUrl);

        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(img, 0, 0);

        let imgData;
        try { imgData = cx.getImageData(0, 0, w, h); }
        catch (e) { return finish(imageUrl); } // 跨域污染 → 回退原图

        const d = imgData.data;
        // 四角采样
        const corners = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y]) => {
          const i = (y * w + x) * 4;
          return [d[i], d[i+1], d[i+2]];
        });
        const bg = corners.reduce((a,c2) => [a[0]+c2[0]/4, a[1]+c2[1]/4, a[2]+c2[2]/4], [0,0,0]);
        const maxDiff = Math.max(...corners.map(c2 => Math.hypot(c2[0]-bg[0], c2[1]-bg[1], c2[2]-bg[2])));

        // 背景不纯色 → 不抠，直接返回原图（避免把角色扣没）
        if (maxDiff > 60) return finish(imageUrl);

        const thr = 70, soft = 40;
        for (let i = 0; i < d.length; i += 4) {
          const dist = Math.hypot(d[i]-bg[0], d[i+1]-bg[1], d[i+2]-bg[2]);
          if (dist < thr) {
            d[i+3] = 0;
          } else if (dist < thr + soft) {
            d[i+3] = Math.round(d[i+3] * (dist - thr) / soft);
          }
        }
        cx.putImageData(imgData, 0, 0);

        // 缩放到 256 以内
        const MAX = 256;
        if (w > MAX || h > MAX) {
          const scale = Math.min(MAX / w, MAX / h);
          const nw = Math.max(1, Math.round(w * scale));
          const nh = Math.max(1, Math.round(h * scale));
          const c2 = document.createElement('canvas');
          c2.width = nw; c2.height = nh;
          const cx2 = c2.getContext('2d');
          cx2.imageSmoothingEnabled = true;
          cx2.drawImage(c, 0, 0, nw, nh);
          return finish(c2.toDataURL('image/png'));
        }
        finish(c.toDataURL('image/png'));
      } catch (e) {
        finish(imageUrl);
      }
    };
    img.onerror = () => finish(imageUrl);
    img.src = proxied;
  });
}
