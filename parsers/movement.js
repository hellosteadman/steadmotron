const dirVerbs = ['go', 'go to', 'head', 'walk', 'walk to']
const getExitNames = (passage) => {
    let returned = []

    Object.keys(passage.exits).forEach(
        (key) => {
            returned.push(key)
            returned.push(key.replace(' ', '-'))
            returned.push(key.replace(' ', ''))
        }
    )

    return returned
}

module.exports = (action, passage, game) => {
    const match = () => {
        const exitNames = getExitNames(passage)
        const ex = new RegExp('^(?:' + dirVerbs.join('|') + ') ?(' + exitNames.join('|') + ')')
        const matches = action.match(ex)

        if (matches && matches.length) {
            const direction = matches[1]

            if (passage.exits[direction]) {
                return passage.exits[direction]
            }
        }

        return null
    }

    const matched = match()

    if (matched !== null) {
        return () => matched(game, passage)
    }
}
