---
allowed-tools: Bash(curl:*)
description: Ask GPT-5 with web browsing for real-time information
argument-hint: [your question]
---

# GPT-5 Web Search

Ask GPT-5 with web browsing capabilities for current events, stock prices, recent news, or real-time information.

**Your Question:** $ARGUMENTS

## Executing GPT-5 Web Search

Running GPT-5 with web browsing enabled...

(!)curl -X POST https://api.openai.com/v1/responses -H "Content-Type: application/json" -H "Authorization: Bearer sk-proj-YOUR_OPENAI_API_KEY_HERE" -d "{\"model\": \"gpt-5\", \"tools\": [{\"type\": \"web_search_preview\"}], \"input\": \"$ARGUMENTS\", \"reasoning\": {\"effort\": \"medium\"}}"(`)