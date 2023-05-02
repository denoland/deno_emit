// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { fromFileUrl } from "../../path/mod.ts";
import { readableStreamFromReader } from "../../streams/conversion.ts";
const clients = new Map();
let clientId = 0;
function dispatch(msg) {
    for (const client of clients.values()){
        client.send(msg);
    }
}
function wsHandler(ws) {
    const id = ++clientId;
    clients.set(id, ws);
    ws.onopen = ()=>{
        dispatch(`Connected: [${id}]`);
    };
    ws.onmessage = (e)=>{
        console.log(`msg:${id}`, e.data);
        dispatch(`[${id}]: ${e.data}`);
    };
    ws.onclose = ()=>{
        clients.delete(id);
        dispatch(`Closed: [${id}]`);
    };
}
async function requestHandler(req) {
    const pathname = new URL(req.request.url).pathname;
    if (req.request.method === "GET" && pathname === "/") {
        //Serve with hack
        const u = new URL("./index.html", import.meta.url);
        if (u.protocol.startsWith("http")) {
            // server launched by deno run http(s)://.../server.ts,
            fetch(u.href).then(async (resp)=>{
                const body = new Uint8Array(await resp.arrayBuffer());
                req.respondWith(new Response(body, {
                    status: resp.status,
                    headers: {
                        "content-type": "text/html"
                    }
                }));
            });
        } else {
            // server launched by deno run ./server.ts
            const file = await Deno.open(fromFileUrl(u));
            req.respondWith(new Response(readableStreamFromReader(file), {
                status: 200,
                headers: {
                    "content-type": "text/html"
                }
            }));
        }
    } else if (req.request.method === "GET" && pathname === "/favicon.ico") {
        req.respondWith(Response.redirect("https://deno.land/favicon.ico", 302));
    } else if (req.request.method === "GET" && pathname === "/ws") {
        const { socket , response  } = Deno.upgradeWebSocket(req.request);
        wsHandler(socket);
        req.respondWith(response);
    }
}
const server = Deno.listen({
    port: 8080
});
console.log("chat server starting on :8080....");
for await (const conn of server){
    (async ()=>{
        const httpConn = Deno.serveHttp(conn);
        for await (const requestEvent of httpConn){
            requestHandler(requestEvent);
        }
    })();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL2V4YW1wbGVzL2NoYXQvc2VydmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBmcm9tRmlsZVVybCB9IGZyb20gXCIuLi8uLi9wYXRoL21vZC50c1wiO1xuaW1wb3J0IHsgcmVhZGFibGVTdHJlYW1Gcm9tUmVhZGVyIH0gZnJvbSBcIi4uLy4uL3N0cmVhbXMvY29udmVyc2lvbi50c1wiO1xuXG5jb25zdCBjbGllbnRzID0gbmV3IE1hcDxudW1iZXIsIFdlYlNvY2tldD4oKTtcbmxldCBjbGllbnRJZCA9IDA7XG5mdW5jdGlvbiBkaXNwYXRjaChtc2c6IHN0cmluZyk6IHZvaWQge1xuICBmb3IgKGNvbnN0IGNsaWVudCBvZiBjbGllbnRzLnZhbHVlcygpKSB7XG4gICAgY2xpZW50LnNlbmQobXNnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3c0hhbmRsZXIod3M6IFdlYlNvY2tldCkge1xuICBjb25zdCBpZCA9ICsrY2xpZW50SWQ7XG4gIGNsaWVudHMuc2V0KGlkLCB3cyk7XG4gIHdzLm9ub3BlbiA9ICgpID0+IHtcbiAgICBkaXNwYXRjaChgQ29ubmVjdGVkOiBbJHtpZH1dYCk7XG4gIH07XG4gIHdzLm9ubWVzc2FnZSA9IChlKSA9PiB7XG4gICAgY29uc29sZS5sb2coYG1zZzoke2lkfWAsIGUuZGF0YSk7XG4gICAgZGlzcGF0Y2goYFske2lkfV06ICR7ZS5kYXRhfWApO1xuICB9O1xuICB3cy5vbmNsb3NlID0gKCkgPT4ge1xuICAgIGNsaWVudHMuZGVsZXRlKGlkKTtcbiAgICBkaXNwYXRjaChgQ2xvc2VkOiBbJHtpZH1dYCk7XG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlcXVlc3RIYW5kbGVyKHJlcTogRGVuby5SZXF1ZXN0RXZlbnQpIHtcbiAgY29uc3QgcGF0aG5hbWUgPSBuZXcgVVJMKHJlcS5yZXF1ZXN0LnVybCkucGF0aG5hbWU7XG4gIGlmIChyZXEucmVxdWVzdC5tZXRob2QgPT09IFwiR0VUXCIgJiYgcGF0aG5hbWUgPT09IFwiL1wiKSB7XG4gICAgLy9TZXJ2ZSB3aXRoIGhhY2tcbiAgICBjb25zdCB1ID0gbmV3IFVSTChcIi4vaW5kZXguaHRtbFwiLCBpbXBvcnQubWV0YS51cmwpO1xuICAgIGlmICh1LnByb3RvY29sLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICAvLyBzZXJ2ZXIgbGF1bmNoZWQgYnkgZGVubyBydW4gaHR0cChzKTovLy4uLi9zZXJ2ZXIudHMsXG4gICAgICBmZXRjaCh1LmhyZWYpLnRoZW4oYXN5bmMgKHJlc3ApID0+IHtcbiAgICAgICAgY29uc3QgYm9keSA9IG5ldyBVaW50OEFycmF5KGF3YWl0IHJlc3AuYXJyYXlCdWZmZXIoKSk7XG4gICAgICAgIHJlcS5yZXNwb25kV2l0aChcbiAgICAgICAgICBuZXcgUmVzcG9uc2UoYm9keSwge1xuICAgICAgICAgICAgc3RhdHVzOiByZXNwLnN0YXR1cyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L2h0bWxcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc2VydmVyIGxhdW5jaGVkIGJ5IGRlbm8gcnVuIC4vc2VydmVyLnRzXG4gICAgICBjb25zdCBmaWxlID0gYXdhaXQgRGVuby5vcGVuKGZyb21GaWxlVXJsKHUpKTtcbiAgICAgIHJlcS5yZXNwb25kV2l0aChcbiAgICAgICAgbmV3IFJlc3BvbnNlKHJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlcihmaWxlKSwge1xuICAgICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgIFwiY29udGVudC10eXBlXCI6IFwidGV4dC9odG1sXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cbiAgfSBlbHNlIGlmIChcbiAgICByZXEucmVxdWVzdC5tZXRob2QgPT09IFwiR0VUXCIgJiYgcGF0aG5hbWUgPT09IFwiL2Zhdmljb24uaWNvXCJcbiAgKSB7XG4gICAgcmVxLnJlc3BvbmRXaXRoKFJlc3BvbnNlLnJlZGlyZWN0KFwiaHR0cHM6Ly9kZW5vLmxhbmQvZmF2aWNvbi5pY29cIiwgMzAyKSk7XG4gIH0gZWxzZSBpZiAocmVxLnJlcXVlc3QubWV0aG9kID09PSBcIkdFVFwiICYmIHBhdGhuYW1lID09PSBcIi93c1wiKSB7XG4gICAgY29uc3QgeyBzb2NrZXQsIHJlc3BvbnNlIH0gPSBEZW5vLnVwZ3JhZGVXZWJTb2NrZXQocmVxLnJlcXVlc3QpO1xuICAgIHdzSGFuZGxlcihzb2NrZXQpO1xuICAgIHJlcS5yZXNwb25kV2l0aChyZXNwb25zZSk7XG4gIH1cbn1cblxuY29uc3Qgc2VydmVyID0gRGVuby5saXN0ZW4oeyBwb3J0OiA4MDgwIH0pO1xuY29uc29sZS5sb2coXCJjaGF0IHNlcnZlciBzdGFydGluZyBvbiA6ODA4MC4uLi5cIik7XG5cbmZvciBhd2FpdCAoY29uc3QgY29ubiBvZiBzZXJ2ZXIpIHtcbiAgKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBodHRwQ29ubiA9IERlbm8uc2VydmVIdHRwKGNvbm4pO1xuICAgIGZvciBhd2FpdCAoY29uc3QgcmVxdWVzdEV2ZW50IG9mIGh0dHBDb25uKSB7XG4gICAgICByZXF1ZXN0SGFuZGxlcihyZXF1ZXN0RXZlbnQpO1xuICAgIH1cbiAgfSkoKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUsU0FBUyxXQUFXLFFBQVEsb0JBQW9CO0FBQ2hELFNBQVMsd0JBQXdCLFFBQVEsOEJBQThCO0FBRXZFLE1BQU0sVUFBVSxJQUFJO0FBQ3BCLElBQUksV0FBVztBQUNmLFNBQVMsU0FBUyxH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