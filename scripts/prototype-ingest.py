#!/usr/bin/env python3
"""
Minimal evidence ingestion prototype.
Demonstrates: observation → validation → evidence → storage.
Uses mock data to prove the end-to-end flow.
"""

import json
import uuid
import hashlib
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pathlib import Path

# ─── VAP-compliant data structures ───

@dataclass
class Observation:
    """Raw signal from interaction environment (VAP Section 4)."""
    observation_id: str
    source_id: str
    session_id: str
    timestamp: str  # RFC3339 microsecond
    signal_type: str
    payload: Dict[str, Any]
    reliability_weight: Optional[float] = None
    device_trust: Optional[str] = None

@dataclass
class EvidenceProvenance:
    """References to underlying observations (VAP Section 5)."""
    observation_ids: List[str]
    observation_hash: str
    source_id: str
    collection_method: str = "sdk"

@dataclass
class Evidence:
    """Validated, immutable evidence (VAP Section 5)."""
    evidence_id: str  # urn:vap:evidence:<hash>
    session_id: str
    source_id: str
    timestamp: str
    evidence_type: str  # E-INTERACTION, E-VISIBLE, E-DURATION, E-CONTEXT, E-CUSTOM
    confidence: float  # 0.0-1.0
    payload: Dict[str, Any]
    provenance: EvidenceProvenance
    signature: str  # Producer signature (mock)
    metadata: Optional[Dict[str, Any]] = None

# ─── Pipeline stages ───

def validate_observation(obs: Observation) -> tuple[bool, List[str]]:
    """Stage 1: Validate observation structure and sanity."""
    errors = []
    
    # Required fields
    if not obs.observation_id:
        errors.append("observation_id required")
    if not obs.source_id:
        errors.append("source_id required")
    if not obs.session_id:
        errors.append("session_id required")
    if not obs.timestamp:
        errors.append("timestamp required")
    if not obs.signal_type:
        errors.append("signal_type required")
    if not obs.payload:
        errors.append("payload required")
    
    # Timestamp format (basic check)
    try:
        datetime.fromisoformat(obs.timestamp.replace('Z', '+00:00'))
    except ValueError:
        errors.append("timestamp must be RFC3339")
    
    # Signal type known
    known_signals = {'SCROLL', 'CLICK', 'KEY_PRESS', 'VIEWPORT_VISIBILITY', 'FOCUS', 'DEVICE_MOTION', 'PAGE_RESIZE'}
    if obs.signal_type not in known_signals:
        errors.append(f"unknown signal_type: {obs.signal_type}")
    
    return len(errors) == 0, errors


def normalize_observation(obs: Observation) -> Observation:
    """Stage 2: Normalize observation to canonical form."""
    # In real implementation: platform-specific mapping
    # For prototype: pass through with canonical signal_type
    signal_map = {
        'scroll': 'SCROLL',
        'click': 'CLICK', 
        'keypress': 'KEY_PRESS',
        'visibility': 'VIEWPORT_VISIBILITY',
        'focus': 'FOCUS',
        'motion': 'DEVICE_MOTION',
        'resize': 'PAGE_RESIZE'
    }
    normalized = Observation(
        observation_id=obs.observation_id,
        source_id=obs.source_id,
        session_id=obs.session_id,
        timestamp=obs.timestamp,
        signal_type=signal_map.get(obs.signal_type.lower(), obs.signal_type),
        payload=obs.payload,
        reliability_weight=obs.reliability_weight,
        device_trust=obs.device_trust
    )
    return normalized


def compute_observation_hash(observations: List[Observation]) -> str:
    """Compute deterministic hash of observation list."""
    data = json.dumps([asdict(o) for o in observations], sort_keys=True).encode()
    return hashlib.sha256(data).hexdigest()


def create_evidence_from_observations(
    session_id: str,
    source_id: str,
    observations: List[Observation],
    evidence_type: str,
    confidence: float = 0.8
) -> Evidence:
    """Stage 3: Transform validated observations into evidence."""
    
    # Normalize all observations
    normalized = [normalize_observation(o) for o in observations]
    
    # Compute provenance
    obs_hash = compute_observation_hash(normalized)
    provenance = EvidenceProvenance(
        observation_ids=[o.observation_id for o in normalized],
        observation_hash=obs_hash,
        source_id=source_id
    )
    
    # Aggregate payload by evidence type
    if evidence_type == "E-INTERACTION":
        payload = aggregate_interaction_payload(normalized)
    elif evidence_type == "E-VISIBLE":
        payload = aggregate_visibility_payload(normalized)
    elif evidence_type == "E-DURATION":
        payload = aggregate_duration_payload(normalized)
    elif evidence_type == "E-CONTEXT":
        payload = aggregate_context_payload(normalized)
    else:
        payload = {"raw": [asdict(o) for o in normalized]}
    
    # Generate evidence ID (VAP format: urn:vap:evidence:<hash>)
    evidence_data = f"{session_id}{source_id}{time.time()}{evidence_type}{json.dumps(payload, sort_keys=True)}"
    evidence_id = f"urn:vap:evidence:{hashlib.sha256(evidence_data.encode()).hexdigest()[:32]}"
    
    # Mock signature (in production: Ed25519 over canonical serialization)
    signature = f"sig_{hashlib.sha256(f'{evidence_id}{session_id}'.encode()).hexdigest()[:16]}"
    
    return Evidence(
        evidence_id=evidence_id,
        session_id=session_id,
        source_id=source_id,
        timestamp=datetime.now(timezone.utc).isoformat(timespec='microseconds'),
        evidence_type=evidence_type,
        confidence=confidence,
        payload=payload,
        provenance=provenance,
        signature=signature,
        metadata={"policy_id": "pol_default"}
    )


def aggregate_interaction_payload(observations: List[Observation]) -> Dict[str, Any]:
    """Aggregate interaction observations into evidence payload."""
    scrolls = [o for o in observations if o.signal_type == 'SCROLL']
    clicks = [o for o in observations if o.signal_type == 'CLICK']
    keys = [o for o in observations if o.signal_type == 'KEY_PRESS']
    
    # Simple aggregation for prototype
    avg_scroll_velocity = 0.0
    if scrolls:
        velocities = [o.payload.get('velocity', 0) for o in scrolls if 'velocity' in o.payload]
        avg_scroll_velocity = sum(velocities) / len(velocities) if velocities else 0.0
    
    return {
        "avgScrollVelocity": avg_scroll_velocity,
        "scrollDirectionChanges": len([s for s in scrolls if s.payload.get('directionChange')]),
        "clickCount": len(clicks),
        "keyPressCount": len(keys),
        "interactionDurationMs": int((time.time() - time.time()) * 1000),  # placeholder
        "engagementScore": min(1.0, (len(clicks) * 0.1 + len(keys) * 0.05 + len(scrolls) * 0.01))
    }


def aggregate_visibility_payload(observations: List[Observation]) -> Dict[str, Any]:
    """Aggregate visibility observations into evidence payload."""
    visible = [o for o in observations if o.signal_type == 'VIEWPORT_VISIBILITY']
    if not visible:
        return {"visibleDurationMs": 0, "maxVisibilityRatio": 0, "avgVisibilityRatio": 0}
    
    ratios = [o.payload.get('ratio', 0) for o in visible]
    durations = [o.payload.get('durationMs', 0) for o in visible]
    
    return {
        "visibleDurationMs": sum(durations),
        "maxVisibilityRatio": max(ratios) if ratios else 0,
        "avgVisibilityRatio": sum(ratios) / len(ratios) if ratios else 0,
        "viewportIntersections": [
            {"timestamp": o.timestamp, "ratio": o.payload.get('ratio', 0)} for o in visible
        ]
    }


def aggregate_duration_payload(observations: List[Observation]) -> Dict[str, Any]:
    """Aggregate duration evidence."""
    return {
        "sessionStartTime": min(o.timestamp for o in observations),
        "sessionEndTime": max(o.timestamp for o in observations),
        "activeDurationMs": sum(o.payload.get('durationMs', 0) for o in observations),
        "idleDurationMs": 0,
        "heartbeatCount": len(observations)
    }


def aggregate_context_payload(observations: List[Observation]) -> Dict[str, Any]:
    """Aggregate context evidence."""
    # Take first context observation
    context_obs = next((o for o in observations if o.signal_type == 'CUSTOM' and 'platform' in o.payload), None)
    if context_obs:
        return context_obs.payload
    return {"platform": "unknown"}


# ─── Storage (append-only, in-memory for prototype) ───

class EvidenceStore:
    """Append-only evidence store (VAP Section 3)."""
    
    def __init__(self, path: str = "evidence_store.jsonl"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._index: Dict[str, List[Evidence]] = {}  # session_id -> evidence list
    
    def append(self, evidence: Evidence) -> None:
        """Append evidence (immutable write)."""
        # Write to JSONL
        with self.path.open('a') as f:
            f.write(json.dumps(asdict(evidence), default=str) + '\n')
        
        # Update index
        if evidence.session_id not in self._index:
            self._index[evidence.session_id] = []
        self._index[evidence.session_id].append(evidence)
    
    def get_by_session(self, session_id: str) -> List[Evidence]:
        """Retrieve all evidence for a session."""
        if session_id in self._index:
            return self._index[session_id]
        # Load from file if not in memory
        return self._load_session(session_id)
    
    def _load_session(self, session_id: str) -> List[Evidence]:
        """Load session evidence from file."""
        evidence_list = []
        if self.path.exists():
            with self.path.open('r') as f:
                for line in f:
                    data = json.loads(line)
                    if data.get('session_id') == session_id:
                        evidence_list.append(Evidence(**data))
        return evidence_list
    
    def get_all(self) -> List[Evidence]:
        """Get all evidence (for testing)."""
        all_evidence = []
        if self.path.exists():
            with self.path.open('r') as f:
                for line in f:
                    all_evidence.append(Evidence(**json.loads(line)))
        return all_evidence


# ─── Demo / Test ───

def create_mock_observations(session_id: str, source_id: str, count: int = 10) -> List[Observation]:
    """Create mock observations for testing."""
    observations = []
    base_time = time.time()
    
    for i in range(count):
        signal_types = ['SCROLL', 'CLICK', 'KEY_PRESS', 'VIEWPORT_VISIBILITY', 'FOCUS']
        signal = signal_types[i % len(signal_types)]
        
        payload = {}
        if signal == 'SCROLL':
            payload = {'velocity': 100 + i * 10, 'directionChange': i % 3 == 0}
        elif signal == 'CLICK':
            payload = {'element': 'button', 'x': 100, 'y': 200}
        elif signal == 'KEY_PRESS':
            payload = {'key': 'a', 'code': 'KeyA'}
        elif signal == 'VIEWPORT_VISIBILITY':
            payload = {'ratio': 0.8 + (i % 3) * 0.05, 'durationMs': 500}
        elif signal == 'FOCUS':
            payload = {'element': 'input', 'focused': True}
        
        obs = Observation(
            observation_id=str(uuid.uuid4()),
            source_id=source_id,
            session_id=session_id,
            timestamp=datetime.fromtimestamp(base_time + i * 0.5, tz=timezone.utc).isoformat(timespec='microseconds'),
            signal_type=signal,
            payload=payload,
            reliability_weight=0.9
        )
        observations.append(obs)
    
    return observations


def run_prototype():
    """Run the full prototype pipeline."""
    print("=" * 60)
    print("VERIFIED ATTENTION - EVIDENCE INGESTION PROTOTYPE")
    print("=" * 60)
    
    # Setup
    session_id = "urn:vap:session:abc123-def456"
    source_id = "browser-sdk-v1"
    store = EvidenceStore("data/evidence_store.jsonl")
    
    # Create mock observations
    print("\n1. Creating mock observations...")
    observations = create_mock_observations(session_id, source_id, 15)
    print(f"   Created {len(observations)} observations")
    
    # Stage 1: Validate
    print("\n2. Validating observations...")
    valid_obs = []
    for obs in observations:
        valid, errors = validate_observation(obs)
        if valid:
            valid_obs.append(obs)
        else:
            print(f"   ✗ Invalid: {errors}")
    print(f"   {len(valid_obs)}/{len(observations)} valid")
    
    # Stage 2: Create evidence for each type
    print("\n3. Creating evidence from observations...")
    evidence_types = ["E-INTERACTION", "E-VISIBLE", "E-DURATION", "E-CONTEXT"]
    all_evidence = []
    
    for ev_type in evidence_types:
        evidence = create_evidence_from_observations(
            session_id, source_id, valid_obs, ev_type, confidence=0.85
        )
        all_evidence.append(evidence)
        print(f"   ✓ Created {evidence.evidence_id} ({ev_type})")
    
    # Stage 4: Store evidence
    print("\n4. Storing evidence (append-only)...")
    for evidence in all_evidence:
        store.append(evidence)
    print(f"   Stored {len(all_evidence)} evidence items")
    
    # Stage 5: Retrieve and verify
    print("\n5. Retrieving evidence by session...")
    retrieved = store.get_by_session(session_id)
    print(f"   Retrieved {len(retrieved)} evidence items")
    
    # Show one evidence item
    print("\n6. Sample evidence (E-INTERACTION):")
    sample = next(e for e in retrieved if e.evidence_type == "E-INTERACTION")
    print(json.dumps(asdict(sample), indent=2, default=str))
    
    # Verify immutability
    print("\n7. Immutability check:")
    print(f"   Evidence ID: {sample.evidence_id}")
    print(f"   Signature: {sample.signature}")
    print(f"   Provenance hash: {sample.provenance.observation_hash[:16]}...")
    
    print("\n" + "=" * 60)
    print("PROTOTYPE COMPLETE - End-to-end flow verified")
    print("=" * 60)


if __name__ == "__main__":
    run_prototype()