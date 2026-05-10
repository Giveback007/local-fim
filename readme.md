# Ollama Benchmarks — Ryzen AI 7 350 / Radeon 860M (gfx1152)

## Hardware Backend Comparison

Model: `qwen2.5-coder:3b` (Q4 instruct) — prompt: "write a fibonacci function in python" --verbose

| Metric | Vulkan | ROCm | CPU |
|--------|--------|------|-----|
| Total duration | 8.89s | 19.53s | 12.31s |
| Load duration | 163ms | 164ms | 1.87s |
| Prompt eval count | 35 tokens | 35 tokens | 35 tokens |
| Prompt eval duration | 46ms | 65ms | 690ms |
| **Prompt eval rate** | **748 t/s** | 534 t/s | 50 t/s |
| Eval count | 244 tokens | 367 tokens | 201 tokens |
| Eval duration | 8.37s | 18.86s | 9.49s |
| **Eval rate (gen)** | **29.13 t/s** | 19.46 t/s | 21.18 t/s |
| Model size loaded | 4.3 GB | 4.3 GB | 2.1 GB |
| Context | 32768 | 32768 | 4096 |

> Note: eval counts differ across runs (different response lengths).

---

## Quant Comparison (Vulkan backend)

Models: `qwen2.5-coder:3b` variants — prompt: "write a fibonacci function in python"

| Model | Quant | Size | Prompt eval rate | Eval rate |
|-------|-------|------|-----------------|-----------|
| qwen2.5-coder:3b | Q4_K_M | 1.9 GB | 1121 t/s | 34.99 t/s |
| qwen2.5-coder:3b-base-q5_K_M | Q5_K_M | 2.2 GB | 36 t/s | 31.25 t/s |
| qwen2.5-coder:3b-base-q6_K | Q6_K | 2.5 GB | 103 t/s | 29.76 t/s |
| qwen2.5-coder:3b-base-q8_0 | Q8_0 | 3.3 GB | 70 t/s | 23.63 t/s |

---

## System Info

| Component | Details |
|-----------|---------|
| CPU | AMD Ryzen AI 7 350 (Zen 5) |
| iGPU | AMD Radeon 860M (RDNA 3.5, gfx1152) |
| RAM | 54.7 GB (UMA — shared with iGPU) |
| OS | Fedora Linux |
| Vulkan driver | RADV Mesa 26.0.5 |
| Ollama version | 0.23.1 |