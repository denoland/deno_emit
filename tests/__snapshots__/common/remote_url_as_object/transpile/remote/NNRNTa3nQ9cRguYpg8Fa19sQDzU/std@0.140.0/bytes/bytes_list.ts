// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/**
 * An abstraction of multiple Uint8Arrays
 */ export class BytesList {
    len = 0;
    chunks = [];
    constructor(){}
    /**
   * Total size of bytes
   */ size() {
        return this.len;
    }
    /**
   * Push bytes with given offset infos
   */ add(value, start = 0, end = value.byteLength) {
        if (value.byteLength === 0 || end - start === 0) {
            return;
        }
        checkRange(start, end, value.byteLength);
        this.chunks.push({
            value,
            end,
            start,
            offset: this.len
        });
        this.len += end - start;
    }
    /**
   * Drop head `n` bytes.
   */ shift(n) {
        if (n === 0) {
            return;
        }
        if (this.len <= n) {
            this.chunks = [];
            this.len = 0;
            return;
        }
        const idx = this.getChunkIndex(n);
        this.chunks.splice(0, idx);
        const [chunk] = this.chunks;
        if (chunk) {
            const diff = n - chunk.offset;
            chunk.start += diff;
        }
        let offset = 0;
        for (const chunk of this.chunks){
            chunk.offset = offset;
            offset += chunk.end - chunk.start;
        }
        this.len = offset;
    }
    /**
   * Find chunk index in which `pos` locates by binary-search
   * returns -1 if out of range
   */ getChunkIndex(pos) {
        let max = this.chunks.length;
        let min = 0;
        while(true){
            const i = min + Math.floor((max - min) / 2);
            if (i < 0 || this.chunks.length <= i) {
                return -1;
            }
            const { offset , start , end  } = this.chunks[i];
            const len = end - start;
            if (offset <= pos && pos < offset + len) {
                return i;
            } else if (offset + len <= pos) {
                min = i + 1;
            } else {
                max = i - 1;
            }
        }
    }
    /**
   * Get indexed byte from chunks
   */ get(i) {
        if (i < 0 || this.len <= i) {
            throw new Error("out of range");
        }
        const idx = this.getChunkIndex(i);
        const { value , offset , start  } = this.chunks[idx];
        return value[start + i - offset];
    }
    /**
   * Iterator of bytes from given position
   */ *iterator(start = 0) {
        const startIdx = this.getChunkIndex(start);
        if (startIdx < 0) return;
        const first = this.chunks[startIdx];
        let firstOffset = start - first.offset;
        for(let i = startIdx; i < this.chunks.length; i++){
            const chunk = this.chunks[i];
            for(let j = chunk.start + firstOffset; j < chunk.end; j++){
                yield chunk.value[j];
            }
            firstOffset = 0;
        }
    }
    /**
   * Returns subset of bytes copied
   */ slice(start, end = this.len) {
        if (end === start) {
            return new Uint8Array();
        }
        checkRange(start, end, this.len);
        const result = new Uint8Array(end - start);
        const startIdx = this.getChunkIndex(start);
        const endIdx = this.getChunkIndex(end - 1);
        let written = 0;
        for(let i = startIdx; i < endIdx; i++){
            const chunk = this.chunks[i];
            const len = chunk.end - chunk.start;
            result.set(chunk.value.subarray(chunk.start, chunk.end), written);
            written += len;
        }
        const last = this.chunks[endIdx];
        const rest = end - start - written;
        result.set(last.value.subarray(last.start, last.start + rest), written);
        return result;
    }
    /**
   * Concatenate chunks into single Uint8Array copied.
   */ concat() {
        const result = new Uint8Array(this.len);
        let sum = 0;
        for (const { value , start , end  } of this.chunks){
            result.set(value.subarray(start, end), sum);
            sum += end - start;
        }
        return result;
    }
}
function checkRange(start, end, len) {
    if (start < 0 || len < start || end < 0 || len < end || end < start) {
        throw new Error("invalid range");
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0MC4wL2J5dGVzL2J5dGVzX2xpc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuLyoqXG4gKiBBbiBhYnN0cmFjdGlvbiBvZiBtdWx0aXBsZSBVaW50OEFycmF5c1xuICovXG5leHBvcnQgY2xhc3MgQnl0ZXNMaXN0IHtcbiAgcHJpdmF0ZSBsZW4gPSAwO1xuICBwcml2YXRlIGNodW5rczoge1xuICAgIHZhbHVlOiBVaW50OEFycmF5O1xuICAgIHN0YXJ0OiBudW1iZXI7IC8vIHN0YXJ0IG9mZnNldCBmcm9tIGhlYWQgb2YgY2h1bmtcbiAgICBlbmQ6IG51bWJlcjsgLy8gZW5kIG9mZnNldCBmcm9tIGhlYWQgb2YgY2h1bmtcbiAgICBvZmZzZXQ6IG51bWJlcjsgLy8gb2Zmc2V0IG9mIGhlYWQgaW4gYWxsIGJ5dGVzXG4gIH1bXSA9IFtdO1xuICBjb25zdHJ1Y3RvcigpIHt9XG5cbiAgLyoqXG4gICAqIFRvdGFsIHNpemUgb2YgYnl0ZXNcbiAgICovXG4gIHNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMubGVuO1xuICB9XG4gIC8qKlxuICAgKiBQdXNoIGJ5dGVzIHdpdGggZ2l2ZW4gb2Zmc2V0IGluZm9zXG4gICAqL1xuICBhZGQodmFsdWU6IFVpbnQ4QXJyYXksIHN0YXJ0ID0gMCwgZW5kID0gdmFsdWUuYnl0ZUxlbmd0aCkge1xuICAgIGlmICh2YWx1ZS5ieXRlTGVuZ3RoID09PSAwIHx8IGVuZCAtIHN0YXJ0ID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNoZWNrUmFuZ2Uoc3RhcnQsIGVuZCwgdmFsdWUuYnl0ZUxlbmd0aCk7XG4gICAgdGhpcy5jaHVua3MucHVzaCh7XG4gICAgICB2YWx1ZSxcbiAgICAgIGVuZCxcbiAgICAgIHN0YXJ0LFxuICAgICAgb2Zmc2V0OiB0aGlzLmxlbixcbiAgICB9KTtcbiAgICB0aGlzLmxlbiArPSBlbmQgLSBzdGFydDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEcm9wIGhlYWQgYG5gIGJ5dGVzLlxuICAgKi9cbiAgc2hpZnQobjogbnVtYmVyKSB7XG4gICAgaWYgKG4gPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMubGVuIDw9IG4pIHtcbiAgICAgIHRoaXMuY2h1bmtzID0gW107XG4gICAgICB0aGlzLmxlbiA9IDA7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGlkeCA9IHRoaXMuZ2V0Q2h1bmtJbmRleChuKTtcbiAgICB0aGlzLmNodW5rcy5zcGxpY2UoMCwgaWR4KTtcbiAgICBjb25zdCBbY2h1bmtdID0gdGhpcy5jaHVua3M7XG4gICAgaWYgKGNodW5rKSB7XG4gICAgICBjb25zdCBkaWZmID0gbiAtIGNodW5rLm9mZnNldDtcbiAgICAgIGNodW5rLnN0YXJ0ICs9IGRpZmY7XG4gICAgfVxuICAgIGxldCBvZmZzZXQgPSAwO1xuICAgIGZvciAoY29uc3QgY2h1bmsgb2YgdGhpcy5jaHVua3MpIHtcbiAgICAgIGNodW5rLm9mZnNldCA9IG9mZnNldDtcbiAgICAgIG9mZnNldCArPSBjaHVuay5lbmQgLSBjaHVuay5zdGFydDtcbiAgICB9XG4gICAgdGhpcy5sZW4gPSBvZmZzZXQ7XG4gIH1cblxuICAvKipcbiAgICogRmluZCBjaHVuayBpbmRleCBpbiB3aGljaCBgcG9zYCBsb2NhdGVzIGJ5IGJpbmFyeS1zZWFyY2hcbiAgICogcmV0dXJucyAtMSBpZiBvdXQgb2YgcmFuZ2VcbiAgICovXG4gIGdldENodW5rSW5kZXgocG9zOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGxldCBtYXggPSB0aGlzLmNodW5rcy5sZW5ndGg7XG4gICAgbGV0IG1pbiA9IDA7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IGkgPSBtaW4gKyBNYXRoLmZsb29yKChtYXggLSBtaW4pIC8gMik7XG4gICAgICBpZiAoaSA8IDAgfHwgdGhpcy5jaHVua3MubGVuZ3RoIDw9IGkpIHtcbiAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgY29uc3QgeyBvZmZzZXQsIHN0YXJ0LCBlbmQgfSA9IHRoaXMuY2h1bmtzW2ldO1xuICAgICAgY29uc3QgbGVuID0gZW5kIC0gc3RhcnQ7XG4gICAgICBpZiAob2Zmc2V0IDw9IHBvcyAmJiBwb3MgPCBvZmZzZXQgKyBsZW4pIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9IGVsc2UgaWYgKG9mZnNldCArIGxlbiA8PSBwb3MpIHtcbiAgICAgICAgbWluID0gaSArIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYXggPSBpIC0gMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGluZGV4ZWQgYnl0ZSBmcm9tIGNodW5rc1xuICAgKi9cbiAgZ2V0KGk6IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKGkgPCAwIHx8IHRoaXMubGVuIDw9IGkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIm91dCBvZiByYW5nZVwiKTtcbiAgICB9XG4gICAgY29uc3QgaWR4ID0gdGhpcy5nZXRDaHVua0luZGV4KGkpO1xuICAgIGNvbnN0IHsgdmFsdWUsIG9mZnNldCwgc3RhcnQgfSA9IHRoaXMuY2h1bmtzW2lkeF07XG4gICAgcmV0dXJuIHZhbHVlW3N0YXJ0ICsgaSAtIG9mZnNldF07XG4gIH1cblxuICAvKipcbiAgICogSXRlcmF0b3Igb2YgYnl0ZXMgZnJvbSBnaXZlbiBwb3NpdGlvblxuICAgKi9cbiAgKml0ZXJhdG9yKHN0YXJ0ID0gMCk6IEl0ZXJhYmxlSXRlcmF0b3I8bnVtYmVyPiB7XG4gICAgY29uc3Qgc3RhcnRJZHggPSB0aGlzLmdldENodW5rSW5kZXgoc3RhcnQpO1xuICAgIGlmIChzdGFydElkeCA8IDApIHJldHVybjtcbiAgICBjb25zdCBmaXJzdCA9IHRoaXMuY2h1bmtzW3N0YXJ0SWR4XTtcbiAgICBsZXQgZmlyc3RPZmZzZXQgPSBzdGFydCAtIGZpcnN0Lm9mZnNldDtcbiAgICBmb3IgKGxldCBpID0gc3RhcnRJZHg7IGkgPCB0aGlzLmNodW5rcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY2h1bmsgPSB0aGlzLmNodW5rc1tpXTtcbiAgICAgIGZvciAobGV0IGogPSBjaHVuay5zdGFydCArIGZpcnN0T2Zmc2V0OyBqIDwgY2h1bmsuZW5kOyBqKyspIHtcbiAgICAgICAgeWllbGQgY2h1bmsudmFsdWVbal07XG4gICAgICB9XG4gICAgICBmaXJzdE9mZnNldCA9IDA7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgc3Vic2V0IG9mIGJ5dGVzIGNvcGllZFxuICAgKi9cbiAgc2xpY2Uoc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIgPSB0aGlzLmxlbik6IFVpbnQ4QXJyYXkge1xuICAgIGlmIChlbmQgPT09IHN0YXJ0KSB7XG4gICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoKTtcbiAgICB9XG4gICAgY2hlY2tSYW5nZShzdGFydCwgZW5kLCB0aGlzLmxlbik7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoZW5kIC0gc3RhcnQpO1xuICAgIGNvbnN0IHN0YXJ0SWR4ID0gdGhpcy5nZXRDaHVua0luZGV4KHN0YXJ0KTtcbiAgICBjb25zdCBlbmRJZHggPSB0aGlzLmdldENodW5rSW5kZXgoZW5kIC0gMSk7XG4gICAgbGV0IHdyaXR0ZW4gPSAwO1xuICAgIGZvciAobGV0IGkgPSBzdGFydElkeDsgaSA8IGVuZElkeDsgaSsrKSB7XG4gICAgICBjb25zdCBjaHVuayA9IHRoaXMuY2h1bmtzW2ldO1xuICAgICAgY29uc3QgbGVuID0gY2h1bmsuZW5kIC0gY2h1bmsuc3RhcnQ7XG4gICAgICByZXN1bHQuc2V0KGNodW5rLnZhbHVlLnN1YmFycmF5KGNodW5rLnN0YXJ0LCBjaHVuay5lbmQpLCB3cml0dGVuKTtcbiAgICAgIHdyaXR0ZW4gKz0gbGVuO1xuICAgIH1cbiAgICBjb25zdCBsYXN0ID0gdGhpcy5jaHVua3NbZW5kSWR4XTtcbiAgICBjb25zdCByZXN0ID0gZW5kIC0gc3RhcnQgLSB3cml0dGVuO1xuICAgIHJlc3VsdC5zZXQobGFzdC52YWx1ZS5zdWJhcnJheShsYXN0LnN0YXJ0LCBsYXN0LnN0YXJ0ICsgcmVzdCksIHdyaXR0ZW4pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgLyoqXG4gICAqIENvbmNhdGVuYXRlIGNodW5rcyBpbnRvIHNpbmdsZSBVaW50OEFycmF5IGNvcGllZC5cbiAgICovXG4gIGNvbmNhdCgpOiBVaW50OEFycmF5IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheSh0aGlzLmxlbik7XG4gICAgbGV0IHN1bSA9IDA7XG4gICAgZm9yIChjb25zdCB7IHZhbHVlLCBzdGFydCwgZW5kIH0gb2YgdGhpcy5jaHVua3MpIHtcbiAgICAgIHJlc3VsdC5zZXQodmFsdWUuc3ViYXJyYXkoc3RhcnQsIGVuZCksIHN1bSk7XG4gICAgICBzdW0gKz0gZW5kIC0gc3RhcnQ7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gY2hlY2tSYW5nZShzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciwgbGVuOiBudW1iZXIpIHtcbiAgaWYgKHN0YXJ0IDwgMCB8fCBsZW4gPCBzdGFydCB8fCBlbmQgPCAwIHx8IGxlbiA8IGVuZCB8fCBlbmQgPCBzdGFydCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcImludmFsaWQgcmFuZ2VcIik7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDOztDQUVDLEdBQ0QsT0FBTyxNQUFNO0lBQ0gsTUFBTSxFQUFFO0lBQ1IsU0FLRixFQUFFLENBQUM7SUFDVCxhQUFjLENBQUM7SUFFZjs7R0FFQyxHQUNELE9BQU87UUFD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