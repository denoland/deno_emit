function printHello() {
    console.log("Hello");
}
function returnsFoo() {
    return "Foo";
}
function printHello2() {
    printHello();
}
function returnsHi() {
    return "Hi";
}
function returnsFoo2() {
    return returnsFoo();
}
function printHello3() {
    printHello2();
}
function throwsError() {
    throw Error("exception from mod1");
}
export { returnsHi as returnsHi };
export { returnsFoo2 as returnsFoo2 };
export { printHello3 as printHello3 };
export { throwsError as throwsError };
