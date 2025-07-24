const mineflayer = require('mineflayer')
const {pathfinder, Movements, goals} = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const autoEat = require('mineflayer-auto-eat').loader

const express = require('express')
const bodyParser = require('body-parser')

const readline = require('readline')

const app = express()
const port = 3000

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Create readline interface for console input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Bot> '
})

// Function to process commands (used by both REST and console)
const processCommand = (commandString, source = 'unknown') => {
    console.log(`Received command from ${source}: ${commandString}`)
    let args = commandString.split(' ')

    if (args[0] === 'start') {
        if (!ANY_READY) {
            ANY_SHOULD_LOG_IN = true
            console.log("Starting Any")
            initBot()
        }
    }
    if (args[0] === 'stop') {
        if (ANY_READY) {
            ANY_SHOULD_LOG_IN = false
            setTimeout(() => {
                bot.quit()
            })
        }
    }

    if (ANY_READY) {
        if (args[0] === 'chat') {
            args.splice(0,1)
            bot.chat(args.join(' '))
        }
        else {
            console.log('Invalid command')
        }
    }

    if (args[0] === 'exit') {
        console.log('Shutting down...')
        if (ANY_READY && bot) {
            bot.quit()
        }
        process.exit(0)
    }
}

// Console input handler
rl.on('line', (input) => {
    const command = input.trim()
    if (command) {
        processCommand(command, 'console')
    }
    rl.prompt()
})

// Handle Ctrl+C gracefully
/*rl.on('SIGINT', () => {
    rl.prompt()
})*/

// REST API endpoints
// ==========================================
app.get('/AnyUp', (req, res) => {
    res.send(ANY_READY)
})

app.post('/Command', async (req, res) => {
    const command = req.body?.command
    if (command) {
        processCommand(command, 'REST API')
    }
    res.send('Command received!')
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    rl.prompt()
});
// ==========================================

let ANY_READY = false
let ANY_SHOULD_LOG_IN = false

const BOT_USERNAME = 'N1kt3'
const bot_options = {
    host : 'localhost',
    port : 25565,
    username : BOT_USERNAME,
    auth : 'offline',
    logErrors: true
}

let bot
let mcData, movements

let lastActivityTime = Date.now()
let isWandering = false
let wanderingStartTime = 0
let targetMob = null

// Item pickup behavior state
let isPickingUpItem = false
let targetItem = null

const initBot = () => {
    bot = mineflayer.createBot(bot_options)
    bot.loadPlugin(pathfinder)
    bot.loadPlugin(pvp)
    bot.loadPlugin(autoEat)

    // Add this line to prevent the MaxListenersExceededWarning
    bot.setMaxListeners(20)

    bot.on('login', () => {
        console.log(`Successfully logged in`)
    })

    bot.on('end', () => {
        ANY_READY = false
        console.log('Disconnected!!!')
        if (ANY_SHOULD_LOG_IN) {
            setTimeout(initBot, 15000)
        }
    })

    bot.on('error', (err) => {
        ANY_READY = false
        if (err.code === 'ECONNREFUSED') {
            console.log('Connection Refused!!!')
        }
    })

    bot.once('spawn', () => {
        ANY_READY = true
        mcData = require('minecraft-data')(bot.version)
        movements = new Movements(bot)
        movements.allow1by1towers = true
        movements.canOpenDoors = true
        bot.autoEat.enableAuto()
        bot.autoEat.setOpts({
            minHunger: 20,
            priority: 'saturation'
        })

        bot._client.removeAllListeners('explosion');
        bot._client.on('explosion', (packet) => {
            try {
              // Validate knockback data before processing
              if (packet.playerKnockback &&
                  typeof packet.playerKnockback.x === 'number' &&
                  typeof packet.playerKnockback.y === 'number' &&
                  typeof packet.playerKnockback.z === 'number' &&
                  isFinite(packet.playerKnockback.x) &&
                  isFinite(packet.playerKnockback.y) &&
                  isFinite(packet.playerKnockback.z)) {

                const knockback = new Vec3(
                  packet.playerKnockback.x,
                  packet.playerKnockback.y,
                  packet.playerKnockback.z
                );
                bot.entity.velocity.add(knockback);
              }
            } catch (err) {
              console.log('Explosion packet error caught:', err.message);
            }
        })
    })

    bot.on('death', resetAllIdleBehaviors)

    bot.on('chat', (username, message) => {
        if (message.includes('time')) {
             bot.chat(`${(Date.now() - lastActivityTime) / 1000}s have passed since last activity.`)
        }
        if (message.includes('health')) {
            bot.chat(`\nHealth: ${bot.health}\nHunger: ${bot.food}`)
        }

    })

    bot.on('physicsTick', async () => {
        if (bot.pathfinder.isMoving() ||
            bot.pathfinder.isMining() ||
            bot.pathfinder.isBuilding()
        )  {
            lastActivityTime = Date.now()
            return
        }
        await botIdle(bot)
    })
}

// Armor slot mappings
const ARMOR_SLOTS = {
    helmet: 5,
    chestplate: 6,
    leggings: 7,
    boots: 8
}

// Armor type mappings with their protection values
const ARMOR_STATS = {
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
}

const PASSIVE_MOBS = [
    'cow', 'pig', 'sheep', 'chicken', 'rabbit', 'horse', 'donkey', 'mule',
    'llama', 'cat', 'wolf', 'parrot', 'turtle', 'panda', 'fox', 'bee',
    'axolotl', 'goat', 'frog', 'villager', 'wandering_trader'
]

function getArmorType(itemName) {
    if (itemName.includes('helmet')) return 'helmet'
    if (itemName.includes('chestplate')) return 'chestplate'
    if (itemName.includes('leggings')) return 'leggings'
    if (itemName.includes('boots')) return 'boots'
    return null
}

function calculateArmorValue(item) {
    if (!item) return 0

    const baseStats = ARMOR_STATS[item.name]
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
            helmet: bot.inventory.slots[ARMOR_SLOTS.helmet],
            chestplate: bot.inventory.slots[ARMOR_SLOTS.chestplate],
            leggings: bot.inventory.slots[ARMOR_SLOTS.leggings],
            boots: bot.inventory.slots[ARMOR_SLOTS.boots]
        }

        // Find all armor pieces in inventory
        const inventoryArmor = bot.inventory.items().filter(item =>
            ARMOR_STATS.hasOwnProperty(item.name)
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
                console.log(`Upgrading ${slotType}: ${equippedItem?.name || 'empty'} -> ${bestItem.name}`)

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
        console.error('Error during armor upgrade:', error)
    }
}

async function equipSword() {
    const sword = bot.inventory.items().find( item => item.name.includes('sword'))
    if (sword) await bot.equip(sword, 'hand')
}

async function equipShield() {
    const sword = bot.inventory.items().find( item => item.name.includes('shield'))
    if (sword) await bot.equip(sword, 'off-hand')
}

function isPassiveMob(entity) {
    return PASSIVE_MOBS.includes(entity.name)
}

function findClosestPassiveMob(bot, radius = 10) {
    let closestEntity = bot.nearestEntity()
    let closestMob = null

    if (closestEntity.position.distanceTo(bot.entity.position) < radius &&
        isPassiveMob(closestEntity)) closestMob = closestEntity

    return closestMob
}

async function handleWandering(bot) {
    const currentTime = Date.now()
    // Check if we should start wandering (been idle for more than 60 seconds)
    if (!isWandering && (currentTime - lastActivityTime) > 60000) {
        //console.log(`${(currentTime - lastActivityTime)/1000}s have passed. Bot is bored.`)
        const mob = findClosestPassiveMob(bot, 30)

        if (mob) {
            console.log(`Bot bored. Mob found: following ${mob.name}`)
            isWandering = true
            wanderingStartTime = currentTime
            targetMob = mob

            // Start following the mob
            const defaultMove = new Movements(bot)
            bot.pathfinder.setMovements(defaultMove)

            const goal = new goals.GoalFollow(mob, 2) // Follow within 2 blocks
            bot.pathfinder.setGoal(goal, true)
        }
    }

    // Check if we should stop wandering (been following for 30 seconds)
    if (isWandering && (currentTime - wanderingStartTime) > 30000) {
        console.log(`Bot finished wandering, going back to idle`)
        isWandering = false
        targetMob = null
        lastActivityTime = currentTime // Reset idle timer

        // Stop following
        bot.pathfinder.setGoal(null)
    }

    // If we're wandering but lost our target, stop wandering
    if (isWandering && targetMob) {
        const distance = bot.entity.position.distanceTo(targetMob.position)
        if (distance > 15 || !targetMob.isValid) { // Mob too far or despawned
            console.log(`Lost target mob, stopping wandering`)
            isWandering = false
            targetMob = null
            lastActivityTime = currentTime
            bot.pathfinder.setGoal(null)
        }
    }
}

async function handleItemPickup(bot) {
    // Don't interrupt other behaviors
    if (isWandering) return false

    // If we're not currently picking up an item, look for one
    if (!isPickingUpItem) {
        const item = (bot.nearestEntity()?.name === 'item' &&
                                 bot.nearestEntity()?.velocity.norm() < 1 &&
                                 bot.nearestEntity()?.position.distanceTo(bot.entity.position) < 10)
                                ? bot.nearestEntity() : null

        if (item) {
            console.log(`Picking up item`)

            isPickingUpItem = true
            targetItem = item

            try {
                const defaultMove = new Movements(bot)
                bot.pathfinder.setMovements(defaultMove)

                const goal = new goals.GoalBlock(item.position.x, item.position.y, item.position.z)
                bot.pathfinder.setGoal(goal, true)

                return true // We're now busy picking up an item
            } catch (error) {
                console.error('Error setting path to item:', error)
                isPickingUpItem = false
                targetItem = null
                return false
            }
        }
    } else {
        // We're currently picking up an item, check if we should stop
        if (!targetItem || !targetItem.isValid) {
            // Item was picked up or despawned
            console.log('Item picked up or despawned, stopping pickup behavior')
            isPickingUpItem = false
            targetItem = null
            bot.pathfinder.setGoal(null)
            return false
        }
        return true // Still picking up item
    }

    return false
}

// Function to stop item pickup when other activities start
function stopItemPickup() {
    if (isPickingUpItem) {
        console.log('Stopping item pickup for other activity')
        isPickingUpItem = false
        targetItem = null
        bot.pathfinder.setGoal(null)
    }
}

// Updated reset function to include item pickup
function resetAllIdleBehaviors() {
    if (isWandering) {
        console.log(`Bot started activity, stopping wandering`)
        isWandering = false
        targetMob = null
    }

    stopItemPickup()
    bot.pathfinder.setGoal(null)
    lastActivityTime = Date.now()
}

async function botIdle(bot) {
    // Handle item pickup first (highest priority)
    const isPickingUp = await handleItemPickup(bot)
    if (isPickingUp) {
        // Update activity time so we don't start wandering while picking up items
        lastActivityTime = Date.now()
        return
    }

    // Handle wandering behavior second
    await handleWandering(bot)

    // If we're currently wandering, don't do normal idle behavior
    if (isWandering) {
        return
    }

    // Idling and close entity behaviour
    const entity = bot.nearestEntity()
    if (entity) {
        // Looking around
        await bot.lookAt(entity.position.offset(0,entity.height,0))

        // Let any T-bag. Be polite :)
        let emote = (entity.metadata[0]&0x02) === 0x02
        if (emote != null) bot.setControlState('sneak', emote)

        // Under attack!!!
        if (entity.type === 'hostile' &&
            entity.position.distanceTo(bot.entity.position) < 5) {
                await equipSword()
                await equipShield()
                await bot.pvp.attack(entity)
        }
    }

    //Be ready
    await checkAndUpgradeArmor(bot)

    // Any is in water
    const pos = bot.entity.position
    const blockAtFeet = bot.blockAt(pos)
    if (blockAtFeet && blockAtFeet.name === 'water') bot.setControlState('jump',true)
    else bot.setControlState('jump', false)
}