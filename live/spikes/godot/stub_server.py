#!/usr/bin/env python3
"""Stdlib-only RFC6455 stub: binds port 0, prints PORT=<n>, answers each text request with vend.glb."""
import asyncio, base64, hashlib, json, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.environ.get("STUB_GLB", os.path.join(HERE, "vend.glb"))
GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
DELAY = float(os.environ.get("STUB_DELAY", "1.0"))


def frame(opcode: int, payload: bytes) -> bytes:
    n = len(payload)
    if n < 126:
        head = struct.pack("!BB", 0x80 | opcode, n)
    elif n < 65536:
        head = struct.pack("!BBH", 0x80 | opcode, 126, n)
    else:
        head = struct.pack("!BBQ", 0x80 | opcode, 127, n)
    return head + payload


async def read_frame(r):
    b0, b1 = await r.readexactly(2)
    op, masked, n = b0 & 0x0F, b1 & 0x80, b1 & 0x7F
    fin = b0 & 0x80
    if n == 126:
        n = struct.unpack("!H", await r.readexactly(2))[0]
    elif n == 127:
        n = struct.unpack("!Q", await r.readexactly(8))[0]
    mask = await r.readexactly(4) if masked else b""
    data = await r.readexactly(n)
    if masked:
        data = bytes(b ^ mask[i & 3] for i, b in enumerate(data))
    return fin, op, data


async def handle(r, w):
    try:
        head = await r.readuntil(b"\r\n\r\n")
        key = None
        for line in head.split(b"\r\n"):
            if line.lower().startswith(b"sec-websocket-key:"):
                key = line.split(b":", 1)[1].strip()
        if not key:
            w.close()
            return
        acc = base64.b64encode(hashlib.sha1(key + GUID).digest())
        w.write(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                b"Connection: Upgrade\r\nSec-WebSocket-Accept: " + acc + b"\r\n\r\n")
        await w.drain()
        buf, buf_op = b"", 0
        while True:
            fin, op, data = await read_frame(r)
            if op == 0x8:
                w.write(frame(0x8, data[:2]))
                await w.drain()
                break
            if op == 0x9:
                w.write(frame(0xA, data))
                await w.drain()
                continue
            if op == 0xA:
                continue
            if op in (0x1, 0x2):
                buf, buf_op = data, op
            elif op == 0x0:
                buf += data
            if not fin:
                continue
            if buf_op == 0x1:
                req = json.loads(buf.decode())
                print("request:", req, flush=True)
                await asyncio.sleep(DELAY)
                with open(GLB, "rb") as f:
                    glb = f.read()
                w.write(frame(0x2, glb))
                await w.drain()
                print("sent %d bytes" % len(glb), flush=True)
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        w.close()


async def main():
    srv = await asyncio.start_server(handle, "127.0.0.1", 0)
    port = srv.sockets[0].getsockname()[1]
    print("PORT=%d" % port, flush=True)
    async with srv:
        await srv.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
