module.exports = (action, passage, game) => {
  if (action.match('^quit')) {
    return () => game.exit()
  }
}
