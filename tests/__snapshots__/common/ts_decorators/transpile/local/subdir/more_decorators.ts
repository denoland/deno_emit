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
export class B {
    method() {
        console.log("method");
    }
}
_ts_decorate([
    a()
], B.prototype, "method", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vc3ViZGlyL21vcmVfZGVjb3JhdG9ycy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJmdW5jdGlvbiBhKCkge1xuICBjb25zb2xlLmxvZyhcImEoKTogZXZhbHVhdGVkXCIpO1xuICByZXR1cm4gKFxuICAgIF90YXJnZXQ6IGFueSxcbiAgICBfcHJvcGVydHlLZXk6IHN0cmluZyxcbiAgICBfZGVzY3JpcHRvcjogUHJvcGVydHlEZXNjcmlwdG9yLFxuICApID0+IHtcbiAgICBjb25zb2xlLmxvZyhcImEoKTogY2FsbGVkXCIpO1xuICB9O1xufVxuXG5leHBvcnQgY2xhc3MgQiB7XG4gIEBhKClcbiAgbWV0aG9kKCkge1xuICAgIGNvbnNvbGUubG9nKFwibWV0aG9kXCIpO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsU0FBUyxJQUFJO0lBQ1gsUUFBUSxHQUFHLENBQUM7SUFDWixPQUFPLENBQ0wsU0FDQSxjQUNBLGNBQ0c7UUFDSCxRQUFRLEdBQUcsQ0FBQztJQUNkO0FBQ0Y7QUFFQSxPQUFPLE1BQU07SUFFWCxTQUFTO1FBQ1AsUUFBUSxHQUFHLENBQUM7SUFDZDtBQUNGLENBQUM7O0lBSkU7R0FEVSJ9