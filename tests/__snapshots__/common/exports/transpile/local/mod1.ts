import { printHello2, returnsFoo } from "./subdir/mod2.ts";
export function returnsHi() {
    return "Hi";
}
export function returnsFoo2() {
    return returnsFoo();
}
export function printHello3() {
    printHello2();
}
export function throwsError() {
    throw Error("exception from mod1");
}
