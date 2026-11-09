let gameRules = {};
let score = 0;

export function initRules(rules) {
    gameRules = rules || { win_condition: 'kill_all', target_value: 10, enemy_damage: 10 };
    score = 0;
}

export function updateRuleState(entities, bullets, playerBody, uiUpdateCallback, gameOverCallback, winCallback) {
    const enemies = entities.filter(e => e.type === 'enemy');
    const coins = entities.filter(e => e.type === 'coin');

    // 1. 胜利判定
    if (gameRules.win_condition === 'kill_all' && enemies.length === 0) {
        winCallback(); return;
    }
    if (gameRules.win_condition === 'collect_coins') {
        score = coins.length; // 简单用剩下的金币数量代替
        if (score === 0 && coins.length === 0) { winCallback(); return; }
    }
    // 可以继续添加 survive_time 等复杂规则...

    // 2. 玩家受伤判定 (简单碰撞)
    if (playerBody) {
        enemies.forEach(en => {
            let dist = Math.hypot(playerBody.position.x - en.body.position.x, playerBody.position.y - en.body.position.y);
            if (dist < 30) {
                // 这里可以触发扣血、无敌帧等逻辑
                // gameOverCallback(); // 暂时保留，避免太难
            }
        });
    }
    
    // 3. 子弹与金币/怪物碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        // 打怪物
        for (let j = enemies.length - 1; j >= 0; j--) {
            let en = enemies[j];
            if (Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y) < 40) {
                en.hp -= 10;
                Matter.World.remove(window.world, b); bullets.splice(i, 1);
                if (en.hp <= 0) { Matter.World.remove(window.world, en.body); entities.splice(entities.indexOf(en), 1); }
                break;
            }
        }
    }

    uiUpdateCallback(enemies.length, score);
}
