# 🆓 FREE RESOURCES & TRIAL TRACKER

> **Last Updated:** June 23, 2026, 6:00 PM EDT
> 
> **Purpose:** Track all free-tier services, trials, and usage limits to maximize pro-bono development

---

## 📊 FREE LLM PROVIDERS

### OpenRouter (https://openrouter.ai)

**Status:** ✅ ACTIVE | **Account Created:** Existing

#### Free Models (100% Free)
- **Cohere: North Mini Code (free)** 
  - Cost: $0/M tokens (input & output)
  - Limit: 20 req/min
  - Use: Code generation, terminal tasks
  
- **NVIDIA: Llama Nemotron Rerank VL 1B V2 (free)**
  - Cost: $0/M tokens
  - Limit: 20 req/min
  - Use: Reranking, retrieval tasks

- **NVIDIA: Nemotron 3.5 Content Safety (free)**
  - Cost: $0/M tokens  
  - Limit: 20 req/min
  - Use: Content moderation

- **NVIDIA: Nemotron 3 Ultra (free)**
  - Cost: $0/M tokens
  - Limit: 20 req/min
  - Use: General reasoning

#### Paid Models - Best Value
- **Z.ai: GLM 5.2**
  - Cost: $1.40/M input, $4.40/M output
  - Context: 1M tokens  - Use: Long-context coding, debugging
  - Note: Released June 2026, open-weight

#### Usage Limits
- **Free tier daily:** 50 req/day (if < $10 credits purchased)
- **Upgraded tier:** 1,000 req/day (if ≥ $10 credits)
- **Rate limit (free models):** 20 req/min
- **Balance check:** `GET https://openrouter.ai/api/v1/key`

**⚠️ ALERT:** If balance goes negative, even FREE models return 402 errors!

**Next Action:** Test free models, monitor daily usage

---

## 🖥️ LOCAL LLM (100% Free, Unlimited)

### Ollama (https://ollama.com)

**Status:** 🟡 TO INSTALL | **Cost:** $0 (runs locally)

#### Recommended Models
- **Qwen2.5-Coder (14B/32B)**
  - Size: 8GB / 18GB
  - Use: Code generation, refactoring
  - Speed: ~20 tokens/sec (on Strix Halo NPU)

- **DeepSeek-R1 (7B/14B)**  
  - Size: 4GB / 8GB
  - Use: Reasoning, chain-of-thought
  - Speed: ~30 tokens/sec

- **Llama 3.3 (70B quantized)**
  - Size: 40GB (Q4)
  - Use: Complex reasoning, general tasks
  - Speed: ~10 tokens/sec

**Installation:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5-coder:14b
ollama pull deepseek-r1:7b
```

**Next Action:** Install Ollama, benchmark NPU performance

---

### LM Studio (https://lmstudio.ai)

**Status:** 🟡 TO INSTALL | **Cost:** $0

- **Advantages:** GUI, model search, quantization tools
- **Disadvantages:** Slightly slower than Ollama
- **Use case:** Visual model management, testing

**Next Action:** Install as backup to Ollama

---

## 🔧 DEVELOPMENT TOOLS (Free Tier)

### GitHub Actions

**Status:** ✅ ACTIVE | **Limits:** 2,000 min/month (free tier)

- **Used this month:** ~45 minutes (PR #39 CI/CD)
- **Remaining:** ~1,955 minutes
- **Resets:** July 1, 2026

**Next Action:** Continue using for CI/CD

---

### GitHub Codespaces

**Status:** ✅ ACTIVE | **Limits:** 120 core-hours/month, 15GB storage

- **Used this month:** ~8 hours
- **Remaining:** ~112 hours
- **Resets:** July 1, 2026

**Next Action:** Continue development in Codespaces

---

### VS Code (Local + Web)

**Status:** ✅ ACTIVE | **Cost:** $0 (100% free)

- **Extensions:** GitHub Copilot (if trial available)
- **Web:** vscode.dev, github.dev

---

## 🎯 TRIAL SERVICES (Track Expiration!)

### ⚠️ NO ACTIVE TRIALS

**Strategy:** Only activate trials when ready to maximize usage

#### Potential Trials to Activate Later:

1. **Cursor IDE Pro Trial**
   - Duration: 14 days
   - Value: $20/month
   - Features: AI pair programming
   - **Activation Date:** TBD
   - **Expiration:** TBD

2. **ZenMux Trial** (if available)
   - Duration: Unknown (check website)
   - Value: Unknown
   - **Activation Date:** TBD

3. **Tabnine Pro Trial**
   - Duration: 14 days
   - Value: $12/month
   - **Activation Date:** TBD

**⚠️ RULE:** Always set calendar reminder 2 days before trial ends!

---

## 📦 FREE APIs & SERVICES

### Dictionary API (dictionaryapi.dev)

**Status:** ✅ ACTIVE (used in PR #39)

- **Cost:** $0
  - **Limit:** Rate-limited (community-maintained, no SLA; high traffic may impact reliability)
  -   - **Use:** Dictionary lookups in telegram-web-translator

### DataMuse API (datamuse.com)

**Status:** ✅ ACTIVE (used in PR #39)

- **Cost:** $0  
- **Limit:** 100,000 req/day
- **Use:** Thesaurus, word associations
-   - **Note:** API keys will be required starting January 1, 2027

---

## 💰 COST OPTIMIZATION STRATEGY

### Priority Order (Cheapest → Most Expensive)

1. **Local LLMs (Ollama)** → $0, unlimited
2. **OpenRouter Free Models** → $0, 50-1000 req/day
3. **OpenRouter Cheap Models (GLM-5.2)** → $0.95/M input
4. **Paid Services** → AVOID unless critical

### Token Efficiency Rules

✅ **DO:**
- Use query-based `get_page_text()` instead of full page
- Batch 5-10 browser actions in single `computer` call
- Use `find` instead of screenshot when possible
- Cache results locally (localStorage, IndexedDB)
- Compress context before sending to LLM

❌ **DON'T:**
- Screenshot every action (~1,600 tokens each)
- Send full HTML dumps (use filtered extraction)
- Repeat identical API calls (implement caching)
- Use expensive models for simple tasks

---

## 📅 MONTHLY RESET TRACKER

| Service | Limit | Used | Remaining | Reset Date | Verified On |
|---------|-------|------|-----------|------------| :--- |
| GitHub Actions | 2,000 min | 45 min | 1,955 min | July 1, 2026 | Jun 23, 2026 |
| GitHub Codespaces | 120 hrs | 8 hrs | 112 hrs | July 1, 2026 | Jun 23, 2026 |
| OpenRouter Free | 50 req/day | 0 | 50 | Daily | Jun 23, 2026 |
| DataMuse API | 100K/day | <100 | ~100K | Daily | Jun 23, 2026 |

---

## 🚨 ALERTS & REMINDERS

### Active Monitoring

- [ ] Check OpenRouter balance weekly: `GET /api/v1/key`
- [ ] Monitor GitHub Actions minutes before major CI runs
- [ ] Track Codespaces hours (shutdown unused instances)
- [ ] Set up browser extension to count API calls

### Expiration Warnings

**No active trials** ✅

---

## 🎬 NEXT ACTIONS

1. ✅ **COMPLETED:** Merge PR #39  
2. ⏳ **IN PROGRESS:** Create this tracker
3. 🔜 **NEXT:** Install Ollama + test local models
4. 🔜 **NEXT:** Build Comet Vision browser extension
5. 🔜 **NEXT:** Test OpenRouter free models
6. 🔜 **NEXT:** Implement token usage analytics

---

## 📝 NOTES

- **Philosophy:** Offline-first, privacy-first, open-source
- **Goal:** Build production-ready AI tools with $0 monthly cost
- **Strategy:** Leverage free tiers + local compute (AMD Strix Halo NPU)

**Last Updated by:** Comet AI Assistant  
**Update Frequency:** Daily during active development
