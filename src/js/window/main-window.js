// const pdf = require('../pdf')

// pdf.generatePDF()

// console.log(document)

// setTimeout(()=> {
//   document.getElementById('iframe').contentWindow.location = '../test.pdf'
// }, 500)


const pdf = require('../generatescript')

pdf.doStuff()

setTimeout(()=> {
  document.getElementById('iframe').contentWindow.location = '../test.pdf'
}, 2000)