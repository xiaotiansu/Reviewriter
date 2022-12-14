import './App.css';
import React from 'react';
import getCaretCoordinates from './textarea-caret.js';

const getTextEditorCoordinates = (textEditor) => {
  if (textEditor) return {top: textEditor.offsetTop, left: textEditor.offsetLeft};
  return {top: 0, left: 0};
}


const AutocompleteDropDown = ({coordinates, setCoordinates}) => {
  const textEditor = document.getElementById('text-editor');
  let {top: textEditorTop, left: textEditorLeft} = getTextEditorCoordinates(textEditor);
  const insertWord = (word) => {
    const textEditor = document.getElementById('text-editor');
    const {selectionStart, selectionEnd} = textEditor;
    const text = textEditor.value;
    const newText = text.substring(0, selectionStart) + word + text.substring(selectionEnd);
    textEditor.value = newText;
    textEditor.focus();
    textEditor.selectionStart = textEditor.selectionEnd = selectionStart + word.length;
    setCoordinates({ ...coordinates, shouldBeVisible: false });
  }
  return (
    coordinates.shouldBeVisible && (
      <div style={{ backgroundColor: '#eee', width: 200, height: 250, borderRadius: 10, position: 'absolute', top: coordinates.y + textEditorTop + 20, left: coordinates.x + textEditorLeft + 20, overflowY: 'scroll'}}>
        { coordinates.suggestions.length == 0 && <div className="dropdown-cell">Loading suggestions...</div> }
        { coordinates.suggestions.map((suggestion, index) => (
          <div className="dropdown-cell dropdown-cell-clickable" key={index} onClick={() => insertWord(suggestion)}>{suggestion}</div>
        ))}
        {/* <div className="dropdown-cell" onClick={() => insertWord("how")}>how</div>
        <div className="dropdown-cell" onClick={() => insertWord("are")}>are</div>
        <div className="dropdown-cell" onClick={() => insertWord("you")}>you</div>
        <div className="dropdown-cell" onClick={() => insertWord("doing")}>doing</div>
        <div className="dropdown-cell" onClick={() => insertWord("working")}>working</div>
        <div className="dropdown-cell" onClick={() => insertWord("playing")}>playing</div>
        <div className="dropdown-cell" onClick={() => insertWord("coding")}>coding</div> */}
    </div>
    )
  );
}

let previousKey = "";

const getLastWordInStringBeforeIndex = (string, index) => {
  let lastWord = "";
  for (let i = index - 1; i >= 0; i--) {
    if (string[i] == " ") {
      break;
    }
    lastWord = string[i] + lastWord;
  }
  return lastWord;
}

const getLast20WordsInStringBeforeIndex = (string, index) => {
  let last20Words = "";
  let count = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (string[i] == " ") {
      count += 1;
    }
    if (count == 20) {
      break;
    }
    last20Words = string[i] + last20Words;
  }
  return last20Words;
}

const predictNextWord = (text, coordinates, setCoordinates) => {
  fetch('http://localhost:5004/predictNextWord?' + new URLSearchParams({
    text: text,
}), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    // body: JSON.stringify({"text": text})
  })
  .then(response => response.json())
  .then(data => {
    console.log(data);
    setCoordinates({ ...coordinates, suggestions: data.suggestions, shouldBeVisible: true });
  })
  .catch((error) => {
    console.log('Error in fetch predictNextWord:', error);
  });
}

const predictNextSentence = (text, coordinates, setCoordinates) => {
  fetch('http://localhost:5004/predictNextSentence?' + new URLSearchParams({
    text: text,
}), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    // body: JSON.stringify({"text": text})
  })
  .then(response => response.json())
  .then(data => {
    console.log(data);
    setCoordinates({ ...coordinates, suggestions: data.suggestions, shouldBeVisible: true });
  })
  .catch((error) => {
    console.log('Error in fetch predictNextSentence:', error);
  });
}

function App() {
  const [coordinates, setCoordinates] = React.useState({ x: 0, y: 0, height: 0, shouldBeVisible: false, suggestions: [] });
  const checkCoordinates = (e) => {
    if (e.key == " ") {
      let textEditor = document.getElementById("text-editor");
      let caret = getCaretCoordinates(textEditor, textEditor.selectionEnd);
      console.log("selectionEnd", textEditor.selectionEnd);
      let newCoordinates = { x: caret.left, y: caret.top, height: caret.height, suggestions: [], shouldBeVisible: true };
      setCoordinates(newCoordinates);
      if (previousKey == ".") {
        predictNextSentence(getLast20WordsInStringBeforeIndex(textEditor.value, textEditor.selectionEnd), newCoordinates, setCoordinates);
      } else {
        predictNextWord(getLast20WordsInStringBeforeIndex(textEditor.value, textEditor.selectionEnd), newCoordinates, setCoordinates);
      }
    } else {
      setCoordinates({ ...coordinates, shouldBeVisible: false });
    }
    previousKey = e.key;
  }
  return (
    <>
      <div className="main-container">
        <p style={{fontSize: '350%', fontWeight: 'bold'}}>
          Vira Copilot
        </p>
        <textarea id="text-editor" onKeyUp={checkCoordinates}></textarea>
      </div>
      <AutocompleteDropDown coordinates={coordinates} setCoordinates={setCoordinates} />
    </>
  );
}

export default App;
