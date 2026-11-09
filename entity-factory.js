const { Bodies } = Matter;

// 通用实体生成器
export function createEntity(type, x, y, w, h) {
    if (type === 'ground') return Bodies.rectangle(x, y, w, h, { isStatic: true, render: { fillStyle: 'rgba(0, 255, 204, 0.8)' } });
    if (type === 'obstacle') return Bodies.rectangle(x, y, w, h, { isStatic: true, render: { fillStyle: '#1a1a2e' } });
    if (type === 'player') return Bodies.rectangle(x, y, w, h, { friction: 0, frictionAir: 0.05, restitution: 0, inertia: Infinity, render: { fillStyle: '#4ea1ff' }, label: 'player' });
    if (type === 'enemy') return Bodies.rectangle(x, y, w, h, { friction: 0, inertia: Infinity, render: { fillStyle: '#ff0000' }, label: 'enemy' });
    if (type === 'coin') return Bodies.circle(x, y, 10, { isStatic: true, render: { fillStyle: '#ffcc00' }, label: 'coin' });
    return null;
}
