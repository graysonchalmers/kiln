import asyncio
import base64
import json
import os
import ws_proto  # noqa: F401  (path set by _path)


class WsClient:
    def __init__(self, r, w):
        self.r, self.w = r, w

    @classmethod
    async def connect(cls, port):
        r, w = await asyncio.open_connection("127.0.0.1", port)
        key = base64.b64encode(os.urandom(16)).decode()
        w.write(f"GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        await w.drain()
        head = await r.readuntil(b"\r\n\r\n")
        assert b"101" in head.split(b"\r\n")[0], head
        return cls(r, w)

    async def send_json(self, obj):
        self.w.write(ws_proto.frame(ws_proto.TEXT, json.dumps(obj).encode(), mask=True))
        await self.w.drain()

    async def send_text(self, text):
        self.w.write(ws_proto.frame(ws_proto.TEXT, text.encode(), mask=True))
        await self.w.drain()

    async def recv(self):
        op, data = await ws_proto.read_message(self.r, self.w)
        return json.loads(data) if op == ws_proto.TEXT else data

    def close(self):
        self.w.close()
