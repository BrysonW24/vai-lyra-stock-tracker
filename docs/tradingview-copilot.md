# Lyra x TradingView Copilot

Drive your **TradingView Desktop** app from Claude, with Lyra's deterministic oversold-recovery
engine as the brain. Claude can read your live chart, switch symbol and timeframe, inject and
backtest a **Lyra strategy as Pine Script**, run replay, and screenshot the result back into a
Finding.

This does **not** rebuild TradingView and does **not** touch TradingView's servers. It talks to
*your own locally running* TradingView Desktop over the **Chrome DevTools Protocol (CDP)** - the
standard debug interface built into every Electron app (VS Code, Slack, Discord all expose it).
Everything stays on your machine. Research only - not financial advice.

## Architecture

```
Lyra finding  ->  Claude Code  ->  tradingview-mcp (CDP client)  ->  TradingView Desktop (port 9222)
   ^                  |                                                       |
   |          generated Pine strategy  (src/lib/pine/lyra-strategy.ts)        |
   +-------------------------- screenshot back into a Finding ----------------+
```

- **The muscle** is the open-source [`tradesdontlie/tradingview-mcp`](https://github.com/tradesdontlie/tradingview-mcp)
  MCP server (Node, ~78 tools over `chrome-remote-interface`). We do not reimplement it.
- **The brain** is Lyra: the Pine strategy generated at `src/lib/pine/lyra-strategy.ts` is a faithful
  mirror of `workers/stock_scanner/signal_engine.py`, so the strategy you backtest is the same logic
  that surfaced the setup.

## Prerequisites

- macOS, Node.js 18+, Claude Code.
- TradingView Desktop (free). Download: https://www.tradingview.com/desktop/

## Setup (one time)

### 1. Launch TradingView Desktop with remote debugging

Quit TradingView completely first (Cmd-Q), then:

```sh
# Preferred on recent builds (Electron 38 / app v2.14+ refuse the flag from a direct spawn):
open -a TradingView --args --remote-debugging-port=9222

# If the app ignores the flag, launch the binary directly instead:
/Applications/TradingView.app/Contents/MacOS/TradingView --remote-debugging-port=9222
```

Verify the port is live:

```sh
curl -s http://localhost:9222/json/version | head
```

You should get a JSON blob with a `webSocketDebuggerUrl`. If you get connection refused, TradingView
is not running with the flag - quit it fully and relaunch with the command above.

### 2. Install the MCP server

```sh
git clone https://github.com/tradesdontlie/tradingview-mcp.git ~/tradingview-mcp
cd ~/tradingview-mcp && npm install
```

> If the launcher fails to attach on a current TradingView build, use the fork
> [`LewisWJackson/tradingview-mcp-jackson`](https://github.com/LewisWJackson/tradingview-mcp-jackson),
> which exists specifically to fix the v2.14+ launch bug and adds a morning-brief workflow.

### 3. Register it with Claude Code

Add to `~/.claude/.mcp.json` (create the file if it does not exist):

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "node",
      "args": ["/Users/brysonwalter/tradingview-mcp/src/server.js"]
    }
  }
}
```

Restart Claude Code so it picks up the server.

### 4. Health check

Ask Claude to run `tv_health_check`. A good connection returns:

```json
{ "success": true, "cdp_connected": true, "chart_symbol": "AAPL", "api_available": true }
```

`cdp_connected: false` or `ECONNREFUSED` means TradingView is not running with
`--remote-debugging-port=9222` - go back to step 1.

## Workflow recipes (drive from a Lyra finding)

Once connected, these are the loops worth keeping. The tool names below are from `tradingview-mcp`.

### Open a finding on the chart

1. `chart_set_symbol` to the finding's ticker (e.g. `AAPL`).
2. `chart_set_timeframe` to `60` (Lyra's native cadence is hourly) or `D` for context.
3. `chart_manage_indicator` to add `RSI`, `MACD`, `Bollinger Bands` - the same studies Lyra reads.
4. `chart_get_state` + `data_get_study_values` to confirm the live RSI / MACD match the finding.

### Backtest the Lyra strategy on this name

1. Copy the Pine from the app: open the ticker, click **Pine** in the chart toolbar (it copies the
   generated strategy to your clipboard). Or have Claude call `generateLyraPineStrategy({ symbol })`.
2. `pine_new` then `pine_set_source` with the strategy text.
3. `pine_smart_compile`, then `pine_get_errors` (should be clean - the generator targets v5).
4. Read the Strategy Tester results; `capture_screenshot` the equity curve and trade list.
5. Optionally `pine_save` to keep it in your TradingView account.

### Replay a setup bar by bar

`replay_start` at the finding's candle time, then `replay_step` / `replay_autoplay` to watch how the
score would have evolved into the entry. `replay_stop` when done.

### Close the loop

`capture_screenshot` and attach it to the Finding as evidence, so the chart read lives next to the
deterministic score.

## Safety and scope

- Local only. CDP runs on `localhost:9222`; nothing is exposed to the network and no Lyra/TradingView
  credentials leave your machine.
- It drives **your** desktop app with **your** logged-in session and data, the same as you clicking.
- The deterministic engine stays the source of truth. The Pine strategy reproduces the score; it does
  not invent numbers and it gives no advice. Backtest results are hypothetical. Research only.
