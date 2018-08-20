(function(mod) {
  if (typeof exports == "object" && typeof module == "object")
    mod(require("../../../node_modules/codemirror"))
  else if (typeof define == "function" && define.amd)
    define(["../../../node_modules/codemirror"], mod)
  else
    mod(CodeMirror)
})((CodeMirror) => {
  CodeMirror.defineOption("indentFountain", false, function(cm, val, old) {
    cm.on("renderLine", function(cm, line, elt) {
      //console.log(line, elt)
      if (String(line.styles[2]).includes('character')) {
        let off = 75
        //elt.style.textIndent = "-" + off + "px";
        elt.style.paddingLeft = (off) + "px";
        elt.style.width = "600px";
      }
      if (String(line.styles[2]).includes('dialogue')) {
        let off = 75
        //elt.style.textIndent = "-" + off + "px";
        elt.style.paddingLeft = (off) + "px";
        elt.style.width = "600px";
      }
    })
  })

  CodeMirror.defineMode('fountain', function(config, cm) {
    var mode = {};

    mode.startState = function() {
      return {
        sceneNumber: 0,
        paragraphNumber: 0,
        showNumber: false
      }
    }

    mode.blankLine = function (state){ 
      state.showNumber = false
      state.dialogue = false
    }


    mode.token = function(stream, state) {
      if (state.dialogue) {
        stream.skipToEnd()
        state.showNumber = true
        state.paragraphNumber++
        return 'dialogue'
      }

      if (stream.match(/^(?!\!)(\.[^\.]{1}.*|(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)(\.| ))(.*)$/, true, true)) {
        state.sceneNumber++
        state.paragraphNumber++
        state.showNumber = true
        return 'scene-header'
      } else if (stream.match(/^=.*$/, true)) {
        state.synopsis = true
        state.showNumber = false
        return 'synopsis'
      } else if (stream.match(/^#.*$/, true)) {
        state.showNumber = false
        return 'section'
      } else if (stream.match(/^([A-Z*_]+[0-9A-Z (._\-#')])/, true)) {
        let string = stream.string + `\n` + (stream.lookAhead(1) ? stream.lookAhead(1) : '')
        if (string.match(/^([A-Z*_]+[0-9A-Z (._\-#')]*)(\^?)?(?:\n(?!\n+))([\s\S]+)/)) {
          state.dialogue = true
          state.showNumber = true
          state.paragraphNumber++
          stream.skipToEnd()
          return 'character'
        } else {
          stream.skipToEnd()
          state.showNumber = true
          state.paragraphNumber++
          return 'action'
        }
      } else if (stream.match(/^(?:\[{2}(?!\[+))(.+)(?:\]{2}(?!\[+))$/, true) || stream.match(/(?:\[{2}(?!\[+))([\s\S]+?)(?:\]{2}(?!\[+))/g, true)) {
        stream.skipToEnd()
        return 'note'
      } else if (stream.match(/^(?:\{{2}(?!\{+))(.+)(?:\}{2}(?!\{+))$/, true)) {
        stream.skipToEnd()
        return 'property'
      } else if (stream.match(/^((?:title|credit|author[s]?|source|notes|draft date|date|contact|copyright|revision)\:)/gim, true)) {
        stream.skipToEnd()
        return 'title-page'
      } else if (stream.match(/^  $/, true)) {
        return 'force-blank-line'
      } else {
        stream.skipToEnd()
        if (stream.string.trim().length > 0) {
          state.paragraphNumber++
          state.showNumber = true
          return 'action'
        }
      }
      stream.skipToEnd()
    }
    return mode
  })

  CodeMirror.defineMIME("text/fountain", "fountain")

})