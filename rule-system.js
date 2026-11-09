let gameRules = {};
let score = 0;

export function initRules(rules) {
    gameRules = rules || { win_condition: 'kill_all', target_value: 10, enemy_damage: 10 };
    score = 0;
}

export function updateRuleState(entities, bullets, playerBody, uiUpdateCallback, gameOverCallback, winCallback) {
    const enemies = entities.filter(e => e.type === 'enemy');
    const coins = entities.filter(e => e.type === 'coin');

    // 1. 胜利判定 (这里更严谨一点)
    if (gameRules.win_condition === 'kill_all' && enemies.length === 0) {
        winCallback(); return;
    }

    if (playerBody) {
        // 2. 玩家受伤判定
        enemies.forEach(en => {
            if (en.body) {
                let dist = Math.hypot(playerBody.position.x - en.body.position.x, playerBody.position.y - en.body.position.y);
                if (dist < 30) {
                    // 这里可以触发扣血机制，为了爽感目前先不扣血
                }
            }
        });
    }
    
    // 3. 子弹打怪物
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            let en = enemies[j];
            if (en.body && b) {
                if (Math.hypot(b.position.x - en.body.position.x, b.position.y - en.body.position.y) < 40) {
                    en.hp -= 10;
                    Matter.World.remove(window.world, b); bullets.splice(i, 1);
                    if (en.hp <= 0) { 
                        Matter.World.remove(window.world, en.body); 
                        entities.splice(entities.indexOf(en), 1); 
                        score += 100; // 杀怪加分
                    }
                    break;
                }
            }
        }
    }

    if (uiUpdateCallback) uiUpdateCallback(enemies.length, score);
}
