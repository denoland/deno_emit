const __default = JSON.parse("{\n  \"$var\": { \"a\": 123, \"b\": [1, 2, 3], \"c\": null },\n  \"with space\": \"invalid variable name\",\n  \"function\": \"reserved word\"\n}");
console.log(__default);
