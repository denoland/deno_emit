import * as circular2 from "./subdir/circular2.ts";

export function f1() {
  console.log("f1");
}

circular2.f2();
