let stats

const titleCritique = () => {
  let comment
  if (stats) {
    comment = 'I really like your title, "<strong>' + stats.title + '</strong>".'
  }

  return comment
}

const update = (incomingStats) => {
  console.log("SETTING!!")
  stats = incomingStats
}

module.exports = {
  update: update,
  titleCritique: titleCritique
}