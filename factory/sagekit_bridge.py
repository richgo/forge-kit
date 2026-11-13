"""Pin and check SageKit evidence outside ForgeKit's candidate execution jobs."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from urllib.error import HTTPError

from sagekit.application import Principal
from sagekit.config import create_application
from sagekit.gates import pin, validate_pin
from sagekit.model import digest, is_digest
from sagekit.service import Remote


STAGES = ("requirements", "release")
APPROVED_INPUTS = ("request.md", "specs/product-requirements.md")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def inside(workspace, name):
    if not isinstance(name, str) or Path(name).is_absolute():
        raise ValueError("approved input must be workspace-relative")
    path = (workspace / name).resolve()
    if not path.is_relative_to(workspace) or not path.is_file():
        raise ValueError(f"approved input is missing or outside the workspace: {name}")
    return path


def read_config(workspace):
    path = workspace / ".forge/sagekit.json"
    if not path.exists():
        return {}
    config = read_json(inside(workspace, ".forge/sagekit.json"))
    if not isinstance(config, dict) or set(config) - {"inputs", "gates", "change"}:
        raise ValueError("invalid SageKit configuration")
    gates = config.get("gates", {})
    if not isinstance(gates, dict) or set(gates) - set(STAGES):
        raise ValueError("configure requirements and release gates")
    for policy in gates.values():
        if not isinstance(policy, dict) or policy.get("mode") not in {"off", "advisory", "required"}:
            raise ValueError("gate mode must be off, advisory, or required")
        if set(policy) - {"mode", "query", "minimum_evidence", "exact_ids", "decision", "context", "questions"}:
            raise ValueError("unexpected SageKit gate policy field")
    return config


def input_hashes(workspace, config):
    extra = config.get("inputs", [])
    if not isinstance(extra, list) or not all(isinstance(name, str) for name in extra):
        raise ValueError("inputs must contain approved workspace-relative file paths")
    inputs = set((*APPROVED_INPUTS, *extra))
    binding = workspace / ".forge/openspec.json"
    if binding.exists() or binding.is_symlink():
        value = read_json(inside(workspace, ".forge/openspec.json"))
        change = value["change"]
        if (not isinstance(change, str) or not change
                or any(not part.isascii() or not part.isalnum() or part.lower() != part
                       for part in change.split("-"))):
            raise ValueError("invalid approved OpenSpec change name")
        change_path = "openspec/changes/" + change
        base = (workspace / change_path).resolve()
        if not base.is_relative_to(workspace) or not base.is_dir():
            raise ValueError("invalid approved OpenSpec change directory")
        inputs.add(".forge/openspec.json")
        inputs.update(path.relative_to(workspace).as_posix() for path in base.rglob("*.md"))
    return {name: sha256(inside(workspace, name)) for name in sorted(inputs)}


def client(corpus, require_remote):
    url = os.getenv("SAGEKIT_REMOTE_URL")
    if url:
        if require_remote and not url.startswith("https://"):
            raise ValueError("hosted ForgeKit requires an HTTPS SageKit origin")
        return Remote(url, os.environ["SAGEKIT_TOKEN"]).dispatch
    if require_remote:
        raise ValueError("configure the SageKit remote origin and read token")
    app = create_application(corpus)
    principal = Principal(scopes=frozenset({"decide"}))
    return lambda command, params: app.dispatch(command, params, principal)


def run_gate(dispatch, stage, policy, pinned, output):
    mode = policy.get("mode", "off")
    if mode == "off":
        result = {"schema": 1, "stage": stage, "mode": mode, "status": "skipped", "allowed": True}
    elif pinned is None:
        result = {"schema": 1, "stage": stage, "mode": mode, "status": "unavailable",
                  "allowed": mode == "advisory"}
    else:
        try:
            request = {**policy, "stage": stage, "inputs": pinned["inputs"]}
            result = dispatch("gate-check", {"policy": request, "pin": pinned})
            if result.get("allowed") is True and ("context" in policy or "questions" in policy):
                bound = (result.get("policy_id") == digest(request)
                         and result.get("context") == policy.get("context")
                         and result.get("snapshot") == pinned["revision"])
                if "questions" in policy:
                    judgments = result.get("judgments")
                    bound = (bound and isinstance(judgments, dict)
                             and judgments.keys() == policy["questions"].keys())
                    if mode == "required":
                        bound = (bound and result.get("disposition") == "pass"
                                 and all(isinstance(item, dict) and item.get("status") == "accepted"
                                         for item in judgments.values()))
                if not bound:
                    result = {"schema": 1, "stage": stage, "mode": mode, "status": "unavailable",
                              "reason": "contextual gate response did not bind the requested policy",
                              "allowed": mode == "advisory"}
        except OSError as error:
            if isinstance(error, HTTPError) and 400 <= error.code < 500:
                raise
            result = {"schema": 1, "stage": stage, "mode": mode, "status": "unavailable",
                      "allowed": mode == "advisory"}
    write_json(output / f"{stage}.json", result)
    if result.get("allowed") is not True:
        raise ValueError(f"SageKit {stage} gate blocked the factory")


def prepare(args, workspace, config):
    policies = config.get("gates", {})
    needed = args.promote or any(policy["mode"] != "off" for policy in policies.values())
    if args.promote:
        change = config.get("change")
        if not isinstance(change, dict) or change.get("kind") not in {"architecture", "product"}:
            raise ValueError("promotion requires a reviewed architecture or product change")
    pinned = None
    dispatch = None
    if needed:
        try:
            dispatch = client(args.corpus, args.require_remote)
            snapshot = dispatch("snapshot", {})
            pinned = pin(snapshot["revision"], input_hashes(workspace, config),
                         snapshot["embedding_profile"])
        except OSError as error:
            if isinstance(error, HTTPError) and 400 <= error.code < 500:
                raise
            if args.promote or any(policy["mode"] == "required" for policy in policies.values()):
                raise ValueError("SageKit snapshot unavailable") from None
    write_json(args.output / "pin.json", {"pin": pinned, "config": digest(config)})
    run_gate(dispatch, "requirements", policies.get("requirements", {}), pinned, args.output)


def complete(args, workspace, config):
    verified_sha = args.receipt_sha256
    if not is_digest(verified_sha) or sha256(args.receipt) != verified_sha:
        raise ValueError("receipt bytes differ from the independent APMX result")
    state = read_json(args.state / "pin.json")
    if state["config"] != digest(config):
        raise ValueError("SageKit policy changed during the factory run")
    pinned = state["pin"]
    if pinned is not None:
        validate_pin(pinned)
        if input_hashes(workspace, config) != pinned["inputs"]:
            raise ValueError("approved inputs changed during the factory run")
    policy = config.get("gates", {}).get("release", {})
    dispatch = client(args.corpus, args.require_remote) if pinned and policy.get("mode", "off") != "off" else None
    run_gate(dispatch, "release", policy, pinned, args.output)
    if args.promote:
        if pinned is None:
            raise ValueError("promotion requires a pinned corpus")
        pipeline = os.environ["GITHUB_REPOSITORY"]
        run_id = os.environ["GITHUB_RUN_ID"]
        write_json(args.output / "promotion.json", {
            "schema": 1, "pipeline": pipeline, "run": run_id, "pin": pinned,
            "status": "success", "approved": True, "independently_verified": True,
            "verification": {
                "uri": f"https://github.com/{pipeline}/actions/runs/{run_id}#apmx-receipt",
                "sha256": verified_sha,
            },
            "change": config["change"],
        })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=("prepare", "complete"))
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--corpus", type=Path, default=Path("corpus"))
    parser.add_argument("--require-remote", action="store_true")
    parser.add_argument("--promote", action="store_true")
    parser.add_argument("--state", type=Path)
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--receipt-sha256")
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    try:
        if args.require_remote and not workspace.is_relative_to(Path.cwd().resolve()):
            raise ValueError("hosted workspace must be inside the reviewed checkout")
        if not workspace.is_dir():
            raise ValueError("workspace must be a directory")
        args.output.mkdir(parents=True, exist_ok=True)
        config = read_config(workspace)
        if args.phase == "prepare":
            prepare(args, workspace, config)
        else:
            if args.state is None or args.receipt is None:
                raise ValueError("complete requires the pin and independently verified receipt")
            complete(args, workspace, config)
    except (ValueError, TypeError, KeyError, OSError) as exc:
        parser.exit(1, f"ForgeKit SageKit integration: {exc}\n")


if __name__ == "__main__":
    main()
