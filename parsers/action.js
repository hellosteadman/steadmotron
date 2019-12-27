module.exports = (action, passage, game) => {
    const match = () => {
        let returned = null

        Object.keys(passage.actions).map(
            (key) => {
                return {
                    regex: new RegExp(key),
                    func: passage.actions[key]
                }
            }
        ).forEach(
            (a) => {
                if (returned === null) {
                    if (action.match(a.regex)) {
                        returned = a.func
                    }
                }
            }
        )

        return returned
    }

    const matched = match()

    if (typeof (matched) === 'function') {
        return () => matched(game, passage)
    }
}
