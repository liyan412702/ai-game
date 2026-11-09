const ZHIPU_KEY = '0872c4e54b384de19de2081c4d87e7f0.wqkFwvMWAQfbrLpz';

// 🌟 必须带有 export
export async function generateWorldConfig(story) {
    const res = await fetch('/api/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ prompt: story }) 
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}

// 🌟 必须带有 export
export async function requestZhipuImage(prompt) {
    try {
        const res = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_KEY}` },
            body: JSON.stringify({ model: 'cogview-3-flash', prompt: prompt, size: '1024x1024' })
        });
        const data = await res.json();
        return (data.data && data.data[0]) ? data.data[0].url : null;
    } catch(e) { return null; }
}

// 🌟 必须带有 export
export async function processImageRemoveBg(imageUrl) {
    return new Promise((resolve) => {
        if (!imageUrl) return resolve(null);
        let isResolved = false;
        const timeoutId = setTimeout(() => {
            if (!isResolved) { isResolved = true; resolve(imageUrl); }
        }, 5000);

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
        
        img.onload = () => {
            if (isResolved) return;
            try {
                const c = document.createElement('canvas');
                c.width = img.width; c.height = img.height;
                const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
                const imgData = cx.getImageData(0, 0, c.width, c.height); const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if ((data[i] + data[i+1] + data[i+2]) < 150) data[i + 3] = 0;
                }
                cx.putImageData(imgData, 0, 0); 
                isResolved = true; clearTimeout(timeoutId); resolve(c.toDataURL()); 
            } catch (e) { isResolved = true; clearTimeout(timeoutId); resolve(imageUrl); }
        };
        img.onerror = () => { if (!isResolved) { isResolved = true; clearTimeout(timeoutId); resolve(imageUrl); } };
    });
}
