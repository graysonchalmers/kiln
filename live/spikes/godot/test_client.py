#!/usr/bin/env python3
"""Stdlib WS client: usage test_client.py <port>. Sends a request, checks reply is a GLB."""
import base64, hashlib, json, os, socket, struct, sys, time

port = int(sys.argv[1])
here = os.path.dirname(os.path.abspath(__file__))
s = socket.create_connection(("127.0.0.1", port), timeout=10)
key = base64.b64encode(os.urandom(16))
s.sendall(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
          b"Sec-WebSocket-Key: " + key + b"\r\nSec-WebSocket-Version: 13\r\n\r\n")
buf = b""
while b"\r\n\r\n" not in buf:
    buf += s.recv(4096)
head, rest = buf.split(b"\r\n\r\n", 1)
exp = base64.b64encode(hashlib.sha1(key + b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest())
assert head.startswith(b"HTTP/1.1 101") and exp in head, head
print("handshake ok")


def send(op, payload):
    m = os.urandom(4)
    n = len(payload)
    h = bytes([0x80 | op]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack("!H", n))
    s.sendall(h + m + bytes(b ^ m[i & 3] for i, b in enumerate(payload)))


def recvn(n):
    global rest
    while len(rest) < n:
        c = s.recv(65536)
        assert c, "closed"
        rest += c
    out, rest = rest[:n], rest[n:]
    return out


t = time.time()
send(1, json.dumps({"prompt": "a vending machine", "size": [1.0, 2.0, 0.8]}).encode())
b0, b1 = recvn(2)
n = b1 & 0x7F
if n == 126:
    n = struct.unpack("!H", recvn(2))[0]
elif n == 127:
    n = struct.unpack("!Q", recvn(8))[0]
data = recvn(n)
dt = time.time() - t
want = os.path.getsize(os.path.join(here, "vend.glb"))
print("opcode=%d len=%d magic=%r elapsed=%.2fs expected_len=%d" % (b0 & 15, n, data[:4], dt, want))
assert b0 & 15 == 2 and data[:4] == b"glTF" and n == want and dt >= 0.9
send(8, struct.pack("!H", 1000))
print("PASS")
