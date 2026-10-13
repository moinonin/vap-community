# AI Authoring Guide

## Purpose

This repository contains the foundational documents for the Verified Attention Engine (VAE), the Verified Attention Protocol (VAP), and the Venture Thesis.

These documents are not product documentation.

They define the philosophy, architecture, protocol, and engineering direction of a proposed new layer of Internet infrastructure.

Every document generated for this repository should therefore be written to the standard expected of long-lived technical infrastructure such as Internet RFCs, W3C Recommendations, academic systems papers, or the architectural documentation of foundational software platforms.

The objective is not to generate marketing material.

The objective is to produce documentation that could reasonably serve as the reference documentation for an Internet protocol ten years from now.

---

# Writing Philosophy

Always write from first principles.

Do not start with implementation.

Do not start with products.

Begin with concepts.

Progress from concepts to architecture.

Progress from architecture to implementation.

Every statement should logically follow from previous statements.

Assume the reader is technically sophisticated.

Do not assume they already agree with the premise.

Explain why every concept exists before describing how it works.

---

# Architectural Philosophy

The project follows an Evidence-Centric Architecture (ECA).

Evidence is the primary architectural primitive.

Everything else is derived from evidence.

Evidence becomes:

Observations

↓

Claims

↓

Confidence

↓

Proofs

↓

Applications

Never invert this relationship.

The architecture should always flow from evidence toward applications.

Never from applications toward evidence.

---

# The Hierarchy of Documents

Always preserve the following hierarchy.

Venture Thesis

↓

Project Charter

↓

Verified Attention Protocol (VAP)

↓

Verified Attention Engine (VAE)

↓

Future implementation specifications

Higher-level documents establish principles.

Lower-level documents implement those principles.

Lower-level documents must never redefine higher-level concepts.

---

# Terminology

Use terminology consistently.

Distinguish clearly between:

Observation

Evidence

Claim

Confidence

Verification

Proof

Protocol

Engine

Implementation

Consumer

Producer

Verifier

Do not use these terms interchangeably.

---

# Scope

The Venture Thesis explains why Verified Attention should exist.

The Project Charter explains what the project intends to build.

The Verified Attention Protocol defines normative behavior.

The Verified Attention Engine defines the reference implementation.

Never mix these responsibilities.

---

# Style

Write in a formal, technical style.

Prefer precision over persuasion.

Avoid hype.

Avoid marketing language.

Avoid exaggerated claims.

Avoid unsupported predictions.

Avoid unnecessary adjectives.

Prefer concise definitions.

Explain assumptions explicitly.

Define new terminology before using it.

---

# Normative Language

Where appropriate, use RFC 2119 terminology.

MUST

MUST NOT

SHOULD

SHOULD NOT

MAY

OPTIONAL

Use these terms only where normative requirements are intended.

---

# Engineering Philosophy

Protocols should outlive implementations.

Implementations may evolve.

Evidence should remain immutable.

Claims are derived.

Confidence is probabilistic.

Verification is reproducible.

Privacy is a first-class requirement.

Interoperability takes precedence over platform optimization.

---

# Scientific Philosophy

Do not state assumptions as facts.

Clearly distinguish:

Known

Observed

Assumed

Hypothesized

Future work

Unknown

Every major assumption should be identified explicitly.

---

# Quality Expectations

Each section should answer:

Why does this exist?

What problem does it solve?

Why is it designed this way?

What alternatives exist?

What trade-offs were accepted?

What assumptions remain?

What future extensions are anticipated?

Avoid superficial descriptions.

Provide architectural reasoning.

---

# Diagrams

Where useful, include Mermaid diagrams.

Prefer conceptual diagrams over implementation diagrams.

Illustrate relationships rather than software modules.

---

# Examples

Provide examples only when they improve understanding.

Examples should illustrate concepts rather than implementation details.

---

# Future Compatibility

Design concepts that can evolve.

Avoid implementation-specific assumptions.

Avoid vendor-specific technologies.

Avoid programming-language-specific terminology.

Avoid cloud-provider-specific terminology.

The protocol should remain valid even if the implementation changes completely.

---

# Architectural North Star

Every document should reinforce the following objective.

> Establish Verified Attention as a new layer of Internet infrastructure.

Every architectural decision should move the platform closer to becoming the Internet's trusted infrastructure for independently verifying human attention while preserving privacy, interoperability, and scientific rigor.

# The Five Questions

Every major section written for this repository should answer, either explicitly or implicitly:

1. Why does this concept exist?

2. Why is it necessary?

3. Why is it designed this way?

4. How does it relate to the Architectural North Star?

5. How does it support Evidence-Centric Architecture?
