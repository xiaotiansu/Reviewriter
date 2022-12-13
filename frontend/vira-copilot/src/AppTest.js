const addSpan = () => {
    let editor = document.getElementById("text-editor");
    editor.innerHTML += " <span class=\"inline-suggestion\">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</span>"
}

function AppTest() {
    return (
        <div style={{padding: 50}}>
            <div contentEditable={true} id="text-editor" style={{marginBottom: 20}}></div>
            <button onClick={addSpan}>Add span to content-editable div</button>
        </div>
    );
}

export default AppTest;