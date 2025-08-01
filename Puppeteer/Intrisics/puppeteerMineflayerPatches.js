const state = require("./puppeteerState");
const {Vec3} = require("vec3")

// Import logging
const { createModuleLogger } = require('./puppeteerLogger')
const log = createModuleLogger('MineflayerPatch')

// Mineflayer explosion event broken for 1.21.4
function explosionHandlerFix(packet){
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
            )
            state.bot.entity.velocity.add(knockback)
        }
    } catch (err) {
        log.error('Explosion packet error caught:', {
            stack: err.stack
        })
    }
}

module.exports = { explosionHandlerFix }