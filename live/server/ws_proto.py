"""Minimal RFC 6455: handshake, framing, whole-message reads. Stdlib only."""
import asyncio
import base64
import hashlib
import os
import struct

GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TEXT, BINARY, CLOSE, PING, PONG = 0x1, 0x2, 0x8, 0x9, 0xA


def frame(opcode: int, payload: bytes, mask: bool = False) -> bytes:
    n = len(payload)
    m = 0x80 if mask else 0
    if n < 126:
        head = struct.pack("!BB", 0x80 | opcode, m | n)
    elif n < 65536:
        head = struct.pack("!BBH", 0x80 | opcode, m | 126, n)
    else:
        head = struct.pack("!BBQ", 0x80 | opcode, m | 127, n)
    if not mask:
        return head + payload
    key = os.urandom(4)
    return head + key + bytes(b ^ key[i & 3] for i, b in enumerate(payload))


async def read_frame(r: asyncio.StreamReader):
    b0, b1 = await r.readexactly(2)
    op, masked, n = b0 & 0x0F, b1 & 0x80, b1 & 0x7F
    if n == 126:
        n = struct.unpack("!H", await r.readexactly(2))[0]
    elif n == 127:
        n = struct.unpack("!Q", await r.readexactly(8))[0]
    key = await r.readexactly(4) if masked else b""
    data = await r.readexactly(n)
    if masked:
        data = bytes(b ^ key[i & 3] for i, b in enumerate(data))
    return bool(b0 & 0x80), op, data


async def accept(r: asyncio.StreamReader, w: asyncio.StreamWriter) -> bool:
    head = await r.readuntil(b"\r\n\r\n")
    key = next((l.split(b":", 1)[1].strip() for l in head.split(b"\r\n")
                if l.lower().startswith(b"sec-websocket-key:")), None)
    if not key:
        return False
    acc = base64.b64encode(hashlib.sha1(key + GUID).digest())
    w.write(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
            b"Sec-WebSocket-Accept: " + acc + b"\r\n\r\n")
    await w.drain()
    return True


async def read_message(r: asyncio.StreamReader, w: asyncio.StreamWriter):
    """Next whole (opcode, payload) message; answers pings; returns (CLOSE, b'') on close."""
    buf, buf_op = b"", 0
    while True:
        fin, op, data = await read_frame(r)
        if op == CLOSE:
            w.write(frame(CLOSE, data[:2]))
            await w.drain()
            return CLOSE, b""
        if op == PING:
            w.write(frame(PONG, data))
            await w.drain()
            continue
        if op == PONG:
            continue
        if op in (TEXT, BINARY):
            buf, buf_op = data, op
        else:
            buf += data
        if fin:
            return buf_op, buf
