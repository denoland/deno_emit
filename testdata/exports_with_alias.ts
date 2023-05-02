export { foo as test1 } from "./subdir/foo.ts";
export { foo as test2 } from "./subdir/foo.ts";
import { foo } from "./subdir/foo.ts";

console.log(foo);
