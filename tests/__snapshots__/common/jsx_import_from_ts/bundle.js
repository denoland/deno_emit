const React = {
    createElement () {}
};
function app() {
    return React.createElement("div", null, React.createElement("h2", null, "asdf"));
}
console.log(app);
