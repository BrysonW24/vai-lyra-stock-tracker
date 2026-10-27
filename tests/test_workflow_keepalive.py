"""Exercise the real composite-action shell offline against a fake GitHub CLI."""

import json
import os
from pathlib import Path
import subprocess
import textwrap

import pytest


ACTION = Path(__file__).resolve().parents[1] / ".github/actions/keepalive/action.yml"


def run_keepalive(tmp_path, workflows):
    workflow_dir = tmp_path / ".github/workflows"
    workflow_dir.mkdir(parents=True)
    for name in workflows:
        (workflow_dir / name).write_text("on:\n  schedule:\n    - cron: '17 * * * *'\n")
    # Non-scheduled workflows must never be queried or enabled.
    (workflow_dir / "ci.yml").write_text("on:\n  push:\n")

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    gh = bin_dir / "gh"
    gh.write_text(textwrap.dedent("""\
        #!/usr/bin/env python3
        import json
        import os
        import sys

        args = sys.argv[1:]
        with open(os.environ["GH_CALLS"], "a") as calls:
            calls.write(json.dumps(args) + "\\n")
        is_put = args[1:3] == ["-X", "PUT"]
        endpoint = args[3] if is_put else args[1]
        name = endpoint.removesuffix("/enable").rsplit("/", 1)[1]
        config = json.loads(os.environ["GH_WORKFLOWS"])[name]
        if config.get("put_error" if is_put else "get_error"):
            print("Resource not accessible by integration", file=sys.stderr)
            sys.exit(1)
        if not is_put:
            print(config["state"])
        """))
    gh.chmod(0o755)
    calls_file = tmp_path / "gh-calls.jsonl"
    runner_temp = tmp_path / "runner-temp"
    runner_temp.mkdir()
    env = {
        **os.environ,
        "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
        "REPO": "test/lyra",
        "GH_TOKEN": "offline-test-token",
        "RUNNER_TEMP": str(runner_temp),
        "GH_CALLS": str(calls_file),
        "GH_WORKFLOWS": json.dumps(workflows),
    }
    # This action has one literal shell block. Execute that exact block with GitHub's bash flags.
    script = textwrap.dedent(ACTION.read_text().split("      run: |\n", 1)[1])
    result = subprocess.run(
        ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
        cwd=tmp_path, env=env, text=True, capture_output=True, check=False,
    )
    calls = [json.loads(line) for line in calls_file.read_text().splitlines()]
    return result, calls


@pytest.mark.parametrize("state", ["active", "disabled_inactivity"])
def test_keepalive_enables_only_eligible_states(tmp_path, state):
    result, calls = run_keepalive(tmp_path, {"scanner.yml": {"state": state}})

    assert result.returncode == 0, result.stderr
    assert calls == [
        ["api", "repos/test/lyra/actions/workflows/scanner.yml", "--jq", ".state"],
        ["api", "-X", "PUT", "repos/test/lyra/actions/workflows/scanner.yml/enable"],
    ]
    assert "kept alive: scanner.yml" in result.stdout


@pytest.mark.parametrize("state", ["disabled_manually", "disabled_fork", "deleted", "future_state", ""])
def test_keepalive_preserves_manual_and_unrecognised_states(tmp_path, state):
    result, calls = run_keepalive(tmp_path, {"scanner.yml": {"state": state}})

    assert result.returncode == 0, result.stderr
    assert len(calls) == 1
    assert calls[0] == ["api", "repos/test/lyra/actions/workflows/scanner.yml", "--jq", ".state"]
    assert "kept alive:" not in result.stdout
    if state == "disabled_manually":
        assert "keeping manually paused workflow disabled: scanner.yml" in result.stdout
    else:
        assert "::warning::" in result.stdout


def test_keepalive_failed_state_lookup_leaves_workflow_unchanged_and_continues(tmp_path):
    result, calls = run_keepalive(tmp_path, {
        "a-unreadable.yml": {"get_error": True},
        "b-active.yml": {"state": "active"},
    })

    assert result.returncode == 0, result.stderr
    assert calls == [
        ["api", "repos/test/lyra/actions/workflows/a-unreadable.yml", "--jq", ".state"],
        ["api", "repos/test/lyra/actions/workflows/b-active.yml", "--jq", ".state"],
        ["api", "-X", "PUT", "repos/test/lyra/actions/workflows/b-active.yml/enable"],
    ]
    assert "::warning::Could not read a-unreadable.yml state - leaving it unchanged." in result.stdout
    assert "Resource not accessible by integration" in result.stdout
    assert "kept alive: b-active.yml" in result.stdout


def test_keepalive_failed_enable_warns_and_continues(tmp_path):
    result, calls = run_keepalive(tmp_path, {
        "a-refused.yml": {"state": "disabled_inactivity", "put_error": True},
        "b-active.yml": {"state": "active"},
    })

    assert result.returncode == 0, result.stderr
    assert len(calls) == 4
    assert "::warning::Could not re-enable a-refused.yml" in result.stdout
    assert "Resource not accessible by integration" in result.stdout
    assert "kept alive: a-refused.yml" not in result.stdout
    assert "kept alive: b-active.yml" in result.stdout
