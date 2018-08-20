console.log('sup')

require('../../../node_modules/codemirror/addon/selection/active-line.js')
require('../../../node_modules/codemirror/addon/hint/show-hint')
require('../../../node_modules/codemirror/addon/hint/anyword-hint')
require('../../../node_modules/codemirror/addon/edit/closebrackets')
require('../vendor/show-invisibles')
require('../vendor/cmmode')

const CodeMirror = require('codemirror')

var myCodeMirror = CodeMirror(document.body, {
  mode:  "fountain",
  tabSize: 2,
  theme: 'monokai',
  cursorBlinkRate: 0,
  showInvisibles: true,
  spellcheck: true,
  lineWrapping: true,
  lineNumbers: true,
  cursorHeight: 1,
  autoCloseBrackets: true,
  styleActiveLine: true,
  extraKeys: {
    "Tab": "autocomplete"
  }
})

myCodeMirror.options.lineNumberFormatter = (line) => {
  let token = myCodeMirror.getTokenAt({line: line-1})
  let lineString

  if (token.state.showNumber && token.string.trim().length > 0) {
    console.log(token)
    lineString = token.state.sceneNumber + '.' + token.state.paragraphNumber
  } else {
    lineString = ''
  }

  console.log(myCodeMirror.getTokenAt({line: line}))
  return lineString
}


console.log(myCodeMirror)


var fs = require('fs');
fs.readFile( '/Users/setpixel/git/explorers-script/EXPLORERS.fountain', function (err, data) {
  if (err) {
    throw err; 
  }
  console.log(myCodeMirror.doc.setValue(data.toString()))

  console.log();
});


// myCodeMirror.on("renderLine", function(cm, line, elt) {
//   console.log(line, elt)

//   if (line.styles[2] == 'scene-header') {
//         let off = 50
//         //elt.style.textIndent = "-" + off + "px";
//         elt.style.paddingLeft = (off) + "px";

//   }
// })



console.log(myCodeMirror.modes)
