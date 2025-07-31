const state = require("./puppeteerState");
const {Vec3} = require("vec3")

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
        console.log('Explosion packet error caught:', err.message)
    }
}

module.exports = { explosionHandlerFix }