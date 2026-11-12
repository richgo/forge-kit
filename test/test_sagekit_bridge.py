import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from sagekit.config import create_application
from sagekit.application import Principal
from sagekit.gates import signed

ROOT = Path(__file__).resolve().parents[1]


class ForgeSageKitTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.project = self.root / "project"
        self.project.mkdir()
        (self.project / ".forge").mkdir()
        (self.project / "specs").mkdir()
        self.config = self.project / ".forge/sagekit.json"
        self.state = self.root / "state"
        self.result = self.root / "result"
        self.corpus = self.root / "corpus"
        self.receipt = self.root / "forge" / "receipt.json"
        self.inputs = self.project / "forge-inputs"
        shutil.copytree(ROOT / "test/fixtures/delegated", self.inputs)
        self.key = "fixture-signing-key-at-least-thirty-two"
        self.env = {**os.environ, "SAGEKIT_REMOTE_URL": "", "SAGEKIT_RECEIPT_KEY": self.key,
                    "GITHUB_REPOSITORY": "richgo/forge-kit", "GITHUB_RUN_ID": "123"}
        for name in ("request.md", "specs/product-requirements.md", "architecture.json"):
            (self.project / name).write_text(f"approved {name}", encoding="utf-8")

    def bridge(self, phase, *flags, success=True):
        result = subprocess.run(
            [sys.executable, str(ROOT / "factory/sagekit_bridge.py"), phase,
             "--workspace", str(self.project), "--corpus", str(self.corpus), *map(str, flags)],
            cwd=self.root, env=self.env, capture_output=True, text=True,
        )
        self.assertEqual(success, result.returncode == 0, result.stderr)
        return result

    def create_policy(self, query="checkout", mode="required"):
        self.config.write_text(json.dumps({
            "inputs": ["architecture.json", *(f"forge-inputs/{path.name}" for path in self.inputs.iterdir())],
            "gates": {
                "requirements": {"mode": mode, "query": query},
                "release": {"mode": mode, "query": query},
            },
            "change": {"kind": "architecture", "title": "Verified checkout",
                       "summary": "Approved and independently verified checkout."},
        }), encoding="utf-8")

    def verify_forge(self):
        for operation in ("run", "verify"):
            result = subprocess.run(["node", str(ROOT / "factory/cli.mjs"),
                                     operation, str(self.receipt.parent), "--inputs", str(self.inputs)],
                                    cwd=ROOT, env=self.env, capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stderr)
        return hashlib.sha256(self.receipt.read_bytes()).hexdigest()

    def complete(self, receipt_sha, *, success=True):
        return self.bridge("complete", "--state", self.state, "--output", self.result,
                           "--receipt", self.receipt, "--receipt-sha256", receipt_sha,
                           "--promote", success=success)

    def test_required_gate_verified_forge_and_vector_write(self):
        self.create_policy()
        app = create_application(self.corpus)
        app.add(Principal(scopes=frozenset({"write"})), {
            "kind": "adr", "title": "checkout", "body": "Verified checkout decisions",
            "source": {"uri": "repo:adr/checkout", "revision": "approved"},
        })
        self.bridge("prepare", "--output", self.state, "--promote")
        self.assertEqual("available", json.loads((self.state / "requirements.json").read_text())["status"])
        receipt_sha = self.verify_forge()
        self.complete(receipt_sha)
        payload = json.loads((self.result / "promotion.json").read_text())
        self.assertEqual(receipt_sha, payload["verification"]["sha256"])
        self.assertEqual("available", json.loads((self.result / "release.json").read_text())["status"])

        app.receipt_key = self.key.encode()
        identity = Principal(scopes=frozenset({"promote"}))
        receipt = signed(payload, app.receipt_key)
        first = app.promote(identity, receipt)
        self.assertEqual(first, app.promote(identity, receipt))
        self.assertEqual({first["id"]}, app.search.vectors.existing({first["id"]}))

        (self.result / "promotion.json").unlink()
        (self.project / "architecture.json").write_text("modified", encoding="utf-8")
        self.assertIn("approved inputs changed", self.complete(receipt_sha, success=False).stderr)
        self.assertFalse((self.result / "promotion.json").exists())

        self.receipt.write_text("tampered receipt", encoding="utf-8")
        self.assertIn("receipt bytes differ", self.complete(receipt_sha, success=False).stderr)
        self.assertFalse((self.result / "promotion.json").exists())

    def test_required_gate_blocks_without_evidence_and_advisory_continues(self):
        self.create_policy()
        self.bridge("prepare", "--output", self.state, success=False)
        self.assertFalse(json.loads((self.state / "requirements.json").read_text())["allowed"])
        self.create_policy(mode="advisory")
        self.bridge("prepare", "--output", self.state)
        self.assertTrue(json.loads((self.state / "requirements.json").read_text())["allowed"])

    def test_off_needs_no_sagekit_endpoint(self):
        self.bridge("prepare", "--output", self.state, "--require-remote")
        self.assertEqual("skipped", json.loads((self.state / "requirements.json").read_text())["status"])
        self.assertFalse(self.corpus.exists())
