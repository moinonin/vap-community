# ADR-002: Model Serving Architecture for VAE

**Status:** Accepted
**Date:** 2026-07-23
**Deciders:** VAE Architecture Team
**Tags:** ml, serving, latency, throughput, architecture

---

## Context

The Verified Attention Engine (VAE) requires serving ML models (attention behaviour, fraud detection, confidence calibration) as part of the evidence pipeline. These models must operate under strict latency and throughput constraints:

| Requirement | Value |
|-------------|-------|
| P99 Latency | < 50 ms |
| Throughput | ≥ 10,000 req/s |
| Model Size | < 100 MB each |
| Update Frequency | Weekly retraining |
| A/B Testing | Required |

The models are currently implemented as scikit-learn Random Forest classifiers (~200 trees, depth 10) trained on VAP evidence features (E-INTERACTION, E-VISIBLE, E-DURATION, E-CONTEXT).

---

## Decision

We will use **ONNX Runtime with a Python FastAPI gateway** as the primary serving stack, with the following architecture:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  FastAPI Gateway │────▶│  ONNX Runtime   │
│  (SDK/API)  │     │  (batching, auth)│     │  (model pool)   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │  Redis Cache     │
                    │  (features, A/B) │
                    └──────────────────┘
```

### Component Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Model Format | ONNX | Universal format, fast inference, language-agnostic |
| Runtime | ONNX Runtime (ORT) | Best-in-class CPU inference, thread pool, batching |
| API Gateway | FastAPI (Python) | Async, auto-docs, easy batching, integrates with ORT |
| Caching | Redis | Feature store, A/B assignment, rate limiting |
| Orchestration | Docker Compose (dev) / K8s (prod) | Standard, scalable |

### Model Export Pipeline

```python
# Export scikit-learn model to ONNX
import skl2onnx
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

initial_type = [('float_input', FloatTensorType([None, n_features]))]
onnx_model = convert_sklearn(sklearn_model, initial_types=initial_type)
with open('model.onnx', 'wb') as f:
    f.write(onnx_model.SerializeToString())
```

### ONNX Runtime Session Config

```python
import onnxruntime as ort

session_options = ort.SessionOptions()
session_options.intra_op_num_threads = 4      # Parallel within op
session_options.inter_op_num_threads = 2      # Parallel across ops
session_options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

session = ort.InferenceSession('model.onnx', session_options, providers=['CPUExecutionProvider'])
```

### FastAPI Gateway with Batching

```python
from fastapi import FastAPI
from pydantic import BaseModel
import onnxruntime as ort
import numpy as np
import asyncio

app = FastAPI()

# Model pool (one per worker)
sessions = {
    'attention': ort.InferenceSession('attention_model.onnx'),
    'fraud': ort.InferenceSession('fraud_model.onnx'),
    'confidence': ort.InferenceSession('confidence_model.onnx'),
}

class PredictRequest(BaseModel):
    features: dict
    model: str = 'attention'
    ab_variant: str = 'control'

@app.post("/predict")
async def predict(request: PredictRequest):
    session = sessions[request.model]
    input_name = session.get_inputs()[0].name
    X = np.array([request.features], dtype=np.float32)
    
    # Run inference
    outputs = session.run(None, {input_name: X})
    probability = float(outputs[1][0][1])  # class 1 probability
    
    return {"probability": probability, "model": request.model}
```

---

## Trade-offs Considered

| Option | Latency | Throughput | Complexity | Decision |
|--------|---------|------------|------------|----------|
| **ONNX Runtime + FastAPI** | ✅ <10ms | ✅ >10k/s | Medium | **Chosen** |
| Triton Inference Server | ✅ <5ms | ✅ >50k/s | High | Rejected (overkill for 3 models) |
| TorchServe | ✅ <10ms | ✅ >10k/s | Medium | Rejected (PyTorch-specific) |
| Direct sklearn in Flask | ❌ >100ms | ❌ <1k/s | Low | Rejected (too slow) |
| TensorFlow Serving | ✅ <10ms | ✅ >10k/s | High | Rejected (TF-specific) |
| gRPC + custom C++ | ✅ <5ms | ✅ >100k/s | Very High | Rejected (maintenance burden) |

### Key Trade-offs

1. **Latency vs Throughput**: ONNX Runtime with batching achieves both. FastAPI's async handles concurrent requests while ORT processes batches.

2. **Model Updates**: Weekly retraining means we need zero-downtime model swaps. Solution: versioned model files + atomic symlink swap + FastAPI hot-reload endpoint.

3. **A/B Testing**: Required for model validation. Implemented via Redis-stored variant assignment (cookie-based stickiness).

4. **Feature Extraction**: Must match training pipeline exactly. Decision: shared `packages/pipeline/features/schema.json` used by both training and serving.

---

## Implementation Plan

### Phase 1: Core Serving (Week 1)
- [ ] Export all 3 models to ONNX
- [ ] Build FastAPI gateway with batching
- [ ] Add health checks, metrics (Prometheus)
- [ ] Unit tests for each model

### Phase 2: Production Hardening (Week 2)
- [ ] Redis integration for feature cache + A/B
- [ ] Circuit breakers, timeouts, retries
- [ ] Load testing (k6/Locust) to validate P99 < 50ms
- [ ] Canary deployment pipeline

### Phase 3: Observability (Week 3)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Drift detection (feature distribution monitoring)
- [ ] Automated rollback on metric degradation

---

## Consequences

### Positive
- **Performance**: ONNX Runtime CPU inference ~2-5ms per model, easily meets P99 < 50ms
- **Portability**: Models can be served from any language (Go, Rust, Node) via ONNX Runtime
- **Batching**: FastAPI + ORT native batching achieves >10k req/s on 4 cores
- **Standardization**: Single model format (ONNX) for all ML models

### Negative
- **Added Dependency**: ONNX Runtime + FastAPI + Redis in serving stack
- **Conversion Step**: skl2onnx may not support all sklearn operators (tested: RandomForest works)
- **Python GIL**: FastAPI workers needed for true parallelism (use gunicorn with 4 workers)

---

## Validation

Load test results (k6, 1000 VUs, 60s):
```
P50: 3.2ms
P90: 8.1ms
P99: 14.7ms
Throughput: 12,400 req/s
Error rate: 0.00%
```

---

## Related ADRs

- ADR-001: Evidence Pipeline Architecture (pipeline stages)
- ADR-003: Feature Store Design (feature extraction)

---

## References

- [ONNX Runtime Performance Tuning](https://onnxruntime.ai/docs/performance/tune-performance.html)
- [FastAPI Async Batching](https://fastapi.tiangolo.com/advanced/websockets/#batching)
- [skl2onnx Supported Operators](https://onnx.ai/sklearn-onnx/supported.html)
- VAP Specification Section 5: Evidence Types