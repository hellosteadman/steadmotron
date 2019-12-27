module.exports = (value) => {
  if (typeof (value) === 'undefined') {
    return false
  }

  if (value === null) {
    return false
  }

  if (typeof (value) === 'function') {
    return true
  }

  if (typeof (value) === 'object') {
    if (typeof (value.then) !== 'undefined') {
      return true
    }
  }

  return false
}
