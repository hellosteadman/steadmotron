module.exports = (action, passage, game) => {
  let returned = null

  game.withInventory(
    (obj, key) => {
      const ex = new RegExp('^(.+) ' + key + '$')
      const matches = action.match(ex)

      if (returned !== null) {
        return
      }

      if (matches && matches.length > 1) {
        returned = () => obj.do(
          game,
          passage,
          matches[1],
          key
        )

        return
      }

      if (Array.isArray(obj.alternates)) {
        obj.alternates.forEach(
          (alt) => {
            const ex = new RegExp('^(.+) ' + alt + '$')
            const matches = action.match(ex)

            if (returned !== null) {
              return
            }

            if (matches && matches.length > 1) {
              returned = () => obj.do(
                game,
                passage,
                matches[1],
                key
              )
            }
          }
        )
      }
    }
  )

  return returned
}
