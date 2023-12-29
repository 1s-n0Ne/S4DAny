const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')

RANGE_GOAL = 1
const BOT_USERNAME = 'NIKTE_DEV'

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: BOT_USERNAME
})

bot.loadPlugin(pathfinder);
console.log("Started mineflayer");

bot.once('spawn', () => {
  console.log("I spawned 👋");
  // bot.chatAddPattern(/(.*)(?::| (?:[\u203a\u00BB>])) (.*)/, 'myEvent');
  bot.addChatPattern('who_just_joined', /(.*)(?::| (?:[\u203a\u00BB>])) (.*)/, { parse: false, repeat: false });
})

bot.on('chat:who_just_joined', matches => {
  console.log(matches)
  // console.log(`${matches[0]} has just joined!`) // should only run once
})

bot.on('message', (jsonMsg, position, sender) => {
    console.log(`Sender: ${sender}`);
    console.log(`Position: ${position}`);
    console.log(`jsonMsg: ${jsonMsg}`);
})