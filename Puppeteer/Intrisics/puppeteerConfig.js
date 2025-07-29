// config.js - All constants and configuration
module.exports = {
    // Bot configuration
    BOT_USERNAME: 'N1kt3',
    BOT_OPTIONS: {
        host: 'localhost',
        port: 25565,
        username: 'N1kt3',
        auth: 'offline',
        logErrors: true
    },

    // Server configuration
    SERVER_PORT: 3000,

    // Armor slot mappings
    ARMOR_SLOTS: {
        helmet: 5,
        chestplate: 6,
        leggings: 7,
        boots: 8
    },

    // Armor type mappings with their protection values
    ARMOR_STATS: {
        // Leather armor
        'leather_helmet': { protection: 1, durability: 55 },
        'leather_chestplate': { protection: 3, durability: 80 },
        'leather_leggings': { protection: 2, durability: 75 },
        'leather_boots': { protection: 1, durability: 65 },

        // Chain armor
        'chainmail_helmet': { protection: 2, durability: 165 },
        'chainmail_chestplate': { protection: 5, durability: 240 },
        'chainmail_leggings': { protection: 4, durability: 225 },
        'chainmail_boots': { protection: 1, durability: 195 },

        // Iron armor
        'iron_helmet': { protection: 2, durability: 165 },
        'iron_chestplate': { protection: 6, durability: 240 },
        'iron_leggings': { protection: 5, durability: 225 },
        'iron_boots': { protection: 2, durability: 195 },

        // Gold armor
        'golden_helmet': { protection: 2, durability: 77 },
        'golden_chestplate': { protection: 5, durability: 112 },
        'golden_leggings': { protection: 3, durability: 105 },
        'golden_boots': { protection: 1, durability: 91 },

        // Diamond armor
        'diamond_helmet': { protection: 3, durability: 363 },
        'diamond_chestplate': { protection: 8, durability: 528 },
        'diamond_leggings': { protection: 6, durability: 495 },
        'diamond_boots': { protection: 3, durability: 429 },

        // Netherite armor
        'netherite_helmet': { protection: 3, durability: 407 },
        'netherite_chestplate': { protection: 8, durability: 592 },
        'netherite_leggings': { protection: 6, durability: 555 },
        'netherite_boots': { protection: 3, durability: 481 }
    },

    // Mob classifications
    PASSIVE_MOBS: [
        'cow', 'pig', 'sheep', 'chicken', 'rabbit', 'horse', 'donkey', 'mule',
        'llama', 'cat', 'wolf', 'parrot', 'turtle', 'panda', 'fox', 'bee',
        'axolotl', 'goat', 'frog', 'villager', 'wandering_trader'
    ],

    ITEM_DURABILITY_MAP : {
        // Pickaxes
        'wooden_pickaxe': 59,
        'stone_pickaxe': 131,
        'iron_pickaxe': 250,
        'golden_pickaxe': 32,
        'diamond_pickaxe': 1561,
        'netherite_pickaxe': 2031,

        // Axes
        'wooden_axe': 59,
        'stone_axe': 131,
        'iron_axe': 250,
        'golden_axe': 32,
        'diamond_axe': 1561,
        'netherite_axe': 2031,

        // Shovels
        'wooden_shovel': 59,
        'stone_shovel': 131,
        'iron_shovel': 250,
        'golden_shovel': 32,
        'diamond_shovel': 1561,
        'netherite_shovel': 2031,

        // Swords
        'wooden_sword': 59,
        'stone_sword': 131,
        'iron_sword': 250,
        'golden_sword': 32,
        'diamond_sword': 1561,
        'netherite_sword': 2031,

        // Others
        'shears': 238
    },

    // Combat configuration
    COMBAT_RANGE: 5,
    RETREAT_HEALTH_THRESHOLD: 6,
    RETREAT_DISTANCE: 15,
    RETREAT_DURATION: 5000,

    // Behavior timings
    IDLE_TIME_BEFORE_WANDERING: 60000, // 60 seconds
    WANDERING_DURATION: 30000, // 30 seconds
    ITEM_PICKUP_RANGE: 10,

    // Auto-eat configuration
    AUTO_EAT_OPTIONS: {
        minHunger: 20,
        priority: 'saturation'
    }
}