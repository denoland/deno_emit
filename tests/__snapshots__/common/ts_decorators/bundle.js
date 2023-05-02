function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function a() {
    console.log("a(): evaluated");
    return (_target, _propertyKey, _descriptor)=>{
        console.log("a(): called");
    };
}
class B {
    method() {
        console.log("method");
    }
}
_ts_decorate([
    a()
], B.prototype, "method", null);
function _ts_decorate1(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
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
_ts_decorate1([
    Decorator()
], SomeClass.prototype, "test", null);
new SomeClass().test();
new B().method();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vc3ViZGlyL21vcmVfZGVjb3JhdG9ycy50cyIsImZpbGU6Ly8vdHNfZGVjb3JhdG9ycy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBhKCkge1xuICBjb25zb2xlLmxvZyhcImEoKTogZXZhbHVhdGVkXCIpO1xuICByZXR1cm4gKFxuICAgIF90YXJnZXQ6IGFueSxcbiAgICBfcHJvcGVydHlLZXk6IHN0cmluZyxcbiAgICBfZGVzY3JpcHRvcjogUHJvcGVydHlEZXNjcmlwdG9yLFxuICApID0+IHtcbiAgICBjb25zb2xlLmxvZyhcImEoKTogY2FsbGVkXCIpO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQiB7XG4gIEBhKClcbiAgbWV0aG9kKCkge1xuICAgIGNvbnNvbGUubG9nKFwibWV0aG9kXCIpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBCIH0gZnJvbSBcIi4vc3ViZGlyL21vcmVfZGVjb3JhdG9ycy50c1wiO1xuXG5mdW5jdGlvbiBEZWNvcmF0b3IoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoXG4gICAgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICAgIHByb3BlcnR5S2V5OiBzdHJpbmcsXG4gICAgZGVzY3JpcHRvcjogVHlwZWRQcm9wZXJ0eURlc2NyaXB0b3I8YW55PixcbiAgKSB7XG4gICAgY29uc3Qgb3JpZ2luYWxGbjogRnVuY3Rpb24gPSBkZXNjcmlwdG9yLnZhbHVlIGFzIEZ1bmN0aW9uO1xuICAgIGRlc2NyaXB0b3IudmFsdWUgPSBhc3luYyBmdW5jdGlvbiAoLi4uYXJnczogYW55W10pIHtcbiAgICAgIHJldHVybiBhd2FpdCBvcmlnaW5hbEZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gICAgcmV0dXJuIGRlc2NyaXB0b3I7XG4gIH07XG59XG5cbmNsYXNzIFNvbWVDbGFzcyB7XG4gIEBEZWNvcmF0b3IoKVxuICBhc3luYyB0ZXN0KCkge31cbn1cblxubmV3IFNvbWVDbGFzcygpLnRlc3QoKTtcbm5ldyBCKCkubWV0aG9kKCk7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsU0FBUyxJQUFJO0lBQ1gsUUFBUSxHQUFHLENBQUM7SUFDWixPQUFPLENBQ0wsU0FDQSxjQUNBLGNBQ0c7UUFDSCxRQUFRLEdBQUcsQ0FBQztJQUNkO0FBQ0Y7QUFFTyxNQUFNO0lBRVgsU0FBUztRQUNQLFFBQVEsR0FBRyxDQUFDO0lBQ2Q7QUFDRjs7SUFKRztHQURVOzs7Ozs7O0FDVGIsU0FBUyxZQUFZO0lBQ25CLE9BQU8sU0FDTCxNQUEyQixFQUMzQixXQUFtQixFQUNuQixVQUF3QyxFQUN4QztRQUNBLE1BQU0sYUFBdUIsV0FBVyxLQUFLO1FBQzdDLFdBQVcsS0FBSyxHQUFHLGVBQWdCLEdBQUcsSUFBVyxFQUFFO1lBQ2pELE9BQU8sTUFBTSxXQUFXLEtBQUssQ0FBQyxJQUFJLEVBQUU7UUFDdEM7UUFDQSxPQUFPO0lBQ1Q7QUFDRjtBQUVBLE1BQU07SUFDSixNQUNNLE9BQU8sQ0FBQztBQUNoQjs7SUFGRztHQURHO0FBS04sSUFBSSxZQUFZLElBQUk7QUFDcEIsUUFBUSxNQUFNIn0=
