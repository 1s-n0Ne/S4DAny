// armor.js - Armor management functionality
const config = require('../Intrisics/puppeteerConfig')

// Import logging
const { createModuleLogger } = require('../Intrisics/puppeteerLogger')
const log = createModuleLogger('Armor')

function getArmorType(itemName) {
    if (itemName.includes('helmet')) return 'helmet'
    if (itemName.includes('chestplate')) return 'chestplate'
    if (itemName.includes('leggings')) return 'leggings'
    if (itemName.includes('boots')) return 'boots'
    return null
}

function calculateArmorValue(item) {
    if (!item) return 0

    const baseStats = config.ARMOR_STATS[item.name]
    if (!baseStats) return 0

    // Base protection value
    let value = baseStats.protection * 100

    // Add durability factor (current durability / max durability)
    const durabilityFactor = (baseStats.durability - (item.durabilityUsed || 0)) / baseStats.durability
    value *= durabilityFactor

    // Add enchantment bonuses if present
    if (item.enchants) {
        item.enchants.forEach(enchant => {
            switch(enchant.name) {
                case 'protection':
                    value += enchant.lvl * 50
                    break
                case 'blast_protection':
                case 'fire_protection':
                case 'projectile_protection':
                    value += enchant.lvl * 30
                    break
                case 'thorns':
                    value += enchant.lvl * 20
                    break
                case 'unbreaking':
                    value += enchant.lvl * 10
                    break
            }
        })
    }

    return value
}

async function checkAndUpgradeArmor(bot) {
    try {
        // Get currently equipped armor
        const equippedArmor = {
            helmet: bot.inventory.slots[config.ARMOR_SLOTS.helmet],
            chestplate: bot.inventory.slots[config.ARMOR_SLOTS.chestplate],
            leggings: bot.inventory.slots[config.ARMOR_SLOTS.leggings],
            boots: bot.inventory.slots[config.ARMOR_SLOTS.boots]
        }

        // Find all armor pieces in inventory
        const inventoryArmor = bot.inventory.items().filter(item =>
            config.ARMOR_STATS.hasOwnProperty(item.name)
        )

        // Group inventory armor by type
        const inventoryArmorByType = {
            helmet: [],
            chestplate: [],
            leggings: [],
            boots: []
        }

        inventoryArmor.forEach(item => {
            const type = getArmorType(item.name)
            if (type) {
                inventoryArmorByType[type].push(item)
            }
        })

        // Check each armor slot for upgrades
        for (const [slotType, equippedItem] of Object.entries(equippedArmor)) {
            const currentValue = calculateArmorValue(equippedItem)
            const availableItems = inventoryArmorByType[slotType]

            if (availableItems.length === 0) continue

            // Find the best armor piece in inventory for this slot
            let bestItem = null
            let bestValue = currentValue

            availableItems.forEach(item => {
                const itemValue = calculateArmorValue(item)
                if (itemValue > bestValue) {
                    bestValue = itemValue
                    bestItem = item
                }
            })

            // If we found a better item, swap it
            if (bestItem) {
                log.info(`Upgrading ${slotType}: ${equippedItem?.name || 'empty'} -> ${bestItem.name}`)

                // Unequip current armor if any
                if (equippedItem) {
                    await bot.unequip('head') // This will move it to inventory
                }

                // Equip the better armor
                await bot.equip(bestItem, slotType === 'helmet' ? 'head' :
                                        slotType === 'chestplate' ? 'torso' :
                                        slotType === 'leggings' ? 'legs' : 'feet')
            }
        }

    } catch (error) {
        log.error('Error during armor upgrade:', {stack: error.stack})
    }
}

async function equipSword(bot) {
    // This should equip the best sword available
    const swords = bot.inventory.items().filter(item =>
        item.name.includes('sword')
    )

    if (swords.length > 0) {
        // Sort by material quality
        log.debug(`There are ${swords.length} swords in the inventory`)
        const swordPriority = {
            'netherite_sword': 5,
            'diamond_sword': 4,
            'iron_sword': 3,
            'golden_sword': 2,
            'stone_sword': 1,
            'wooden_sword': 0
        }

        swords.sort((a, b) => (swordPriority[b.name] || 0) - (swordPriority[a.name] || 0))
        log.debug(`Equiping ${swords[0].name}`)
        await bot.equip(swords[0], 'hand')
    }
}

async function equipShield(bot) {
    const shield = bot.inventory.items().find(item => item.name.includes('shield'))
    if (shield) await bot.equip(shield, 'off-hand')
}

module.exports = {
    checkAndUpgradeArmor,
    equipSword,
    equipShield
}