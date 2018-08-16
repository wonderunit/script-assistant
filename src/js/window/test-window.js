console.log('sup')

//const CodeMirror = require('codemirror')

var myCodeMirror = CodeMirror(document.body, {
  value: "function myScript(){return 100;}\n",
  mode:  "markdown",
  theme: "twilight",
  tabSize: 2,
  lineWrapping: true,
  lineNumbers: true,
  lineNumberFormatter: (line) => {return '' + line + ": a"},
  cursorHeight: 1,
  styleActiveLine: true,
});


console.log(myCodeMirror.modes)
