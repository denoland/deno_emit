import j from "./escape.json" assert { type: "json" };

export default function payload(): string {
  return JSON.stringify(j);
}
