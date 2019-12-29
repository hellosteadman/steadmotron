module.exports = (action, passage, game) => {
  if (action === 'score') {
    return async () => {
      const points = game.getScore()
      const plural = points === 1 ? '' : 's'

      await game.say(`You have ${points} point${plural}`)
    }
  }
}
