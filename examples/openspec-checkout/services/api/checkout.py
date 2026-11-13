import json
import sys
from pathlib import Path

contract = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(json.dumps({"total": 2500, "currency": contract["currency"]}))
