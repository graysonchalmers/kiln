import pathlib, sys
SERVER = pathlib.Path(__file__).resolve().parents[1]
REPO = SERVER.parents[1]
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))
