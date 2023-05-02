function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
import { B } from "./subdir/more_decorators.ts";
function Decorator() {
    return function(target, propertyKey, descriptor) {
        const originalFn = descriptor.value;
        descriptor.value = async function(...args) {
            return await originalFn.apply(this, args);
        };
        return descriptor;
    };
}
class SomeClass {
    async test() {}
}
_ts_decorate([
    Decorator()
], SomeClass.prototype, "test", null);
new SomeClass().test();
new B().method();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vdHNfZGVjb3JhdG9ycy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCIH0gZnJvbSBcIi4vc3ViZGlyL21vcmVfZGVjb3JhdG9ycy50c1wiO1xuXG5mdW5jdGlvbiBEZWNvcmF0b3IoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoXG4gICAgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICAgIHByb3BlcnR5S2V5OiBzdHJpbmcsXG4gICAgZGVzY3JpcHRvcjogVHlwZWRQcm9wZXJ0eURlc2NyaXB0b3I8YW55PixcbiAgKSB7XG4gICAgY29uc3Qgb3JpZ2luYWxGbjogRnVuY3Rpb24gPSBkZXNjcmlwdG9yLnZhbHVlIGFzIEZ1bmN0aW9uO1xuICAgIGRlc2NyaXB0b3IudmFsdWUgPSBhc3luYyBmdW5jdGlvbiAoLi4uYXJnczogYW55W10pIHtcbiAgICAgIHJldHVybiBhd2FpdCBvcmlnaW5hbEZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gICAgcmV0dXJuIGRlc2NyaXB0b3I7XG4gIH07XG59XG5cbmNsYXNzIFNvbWVDbGFzcyB7XG4gIEBEZWNvcmF0b3IoKVxuICBhc3luYyB0ZXN0KCkge31cbn1cblxubmV3IFNvbWVDbGFzcygpLnRlc3QoKTtcbm5ldyBCKCkubWV0aG9kKCk7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsU0FBUyxDQUFDLFFBQVEsOEJBQThCO0FBRWhELFNBQVMsWUFBWTtJQUNuQixPQUFPLFNBQ0wsTUFBMkIsRUFDM0IsV0FBbUIsRUFDbkIsVUFBd0MsRUFDeEM7UUFDQSxNQUFNLGFBQXVCLFdBQVcsS0FBSztRQUM3QyxXQUFXLEtBQUssR0FBRyxlQUFnQixHQUFHLElBQVcsRUFBRTtZQUNqRCxPQUFPLE1BQU0sV0FBVyxLQUFLLENBQUMsSUFBSSxFQUFFO1FBQ3RDO1FBQ0EsT0FBTztJQUNUO0FBQ0Y7QUFFQSxNQUFNO0lBQ0osTUFDTSxPQUFPLENBQUM7QUFDaEI7O0lBRkc7R0FERztBQUtOLElBQUksWUFBWSxJQUFJO0FBQ3BCLElBQUksSUFBSSxNQUFNIn0=