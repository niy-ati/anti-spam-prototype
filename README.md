# Rocket.Chat Anti-Spam Prototype (Behavioral Detection)

## Overview

This repository contains a small working prototype built on top of the Rocket.Chat Apps Engine to explore how behavioral signals can be used to detect potential spam activity from new users.

The goal of this prototype is not to provide a complete anti-spam system, but to validate whether meaningful signals (like message frequency) can be captured, stored, and analyzed in real time within the Rocket.Chat ecosystem.

---

## What This Prototype Does

- Hooks into message events using `executePostMessageSent`
- Tracks per-user message timestamps
- Maintains a small rolling window of recent activity
- Detects burst messaging behavior (e.g., multiple messages within a short time span)
- Logs detection signals in real time

---

## Why This Matters

In most communities, early-stage spam is not always obvious from a single message. Instead, it emerges as a pattern:

- repeated messages  
- high-frequency posting  
- broadcast-like behavior  

This prototype focuses on capturing that **behavioral layer**, which can later be combined with other signals like similarity, cross-channel activity, or link analysis.

---

## How It Works

### 1. Event Hook
The app listens to message events using:
```text
executePostMessageSent()
```

This ensures:
- zero interference with message flow  
- compatibility with existing architecture  
- ability to process signals asynchronously  

---

### 2. State Tracking

For each user:
- timestamps of recent messages are stored using Apps Engine persistence
- only the last ~10 messages are retained (to keep it lightweight)

---

### 3. Detection Logic

A simple sliding window is applied:

- count messages sent within the last 10 seconds  
- if count ≥ 5 → mark as burst behavior  

---

### 4. Output

When a burst is detected:
⚠️ Burst detected for user <userId>


This is currently logged to the server for validation purposes.

---

## Demo (What Was Tested)

The system was tested locally using Docker-based Rocket.Chat setup.

Test scenario:
1. Send multiple messages rapidly from the same user  
2. Observe logs in real time  

Result:
- hook triggers for each message  
- timestamps accumulate correctly  
- burst detection is triggered once threshold is crossed  

---
## Key Design Decisions

### Lightweight First
The prototype intentionally avoids:
- heavy ML models  
- expensive synchronous checks  

Instead, it focuses on:
- minimal overhead  
- fast execution  
- incremental signal building  

---

### Separation of Concerns

- message capture → synchronous hook  
- behavior analysis → lightweight computation  
- future scoring → can be asynchronous  

---

### Extensibility

This system is designed to be extended with:

- similarity detection  
- cross-channel activity tracking  
- link/domain analysis  
- risk scoring  
- moderator-facing summaries  

---

## Limitations (Current Scope)

- only considers message frequency  
- no content-level analysis yet  
- no automated moderation actions  
- no UI/dashboard  

This is intentional, as the goal was to validate feasibility before expanding scope.

---

## Future Direction

Planned improvements include:

- combining multiple behavioral signals  
- introducing user-level risk scoring  
- adding explainable reasoning for flagged users  
- building moderator-facing summaries  
- integrating with automated moderation workflows  

---

## Setup (Simplified)

1. Run Rocket.Chat locally (Docker)
2. Deploy app using Apps CLI:
  ```text
rc-apps deploy --url http://localhost:3000
 -u <username> -p <password>
 ```
4. Send messages rapidly to trigger detection
5. Observe logs:
```text
docker logs -f rocketchat
```

---

## Final Note

This prototype was built to validate a core assumption:

> Behavioral patterns can be captured and processed in real time within Rocket.Chat without impacting message flow.

With this confirmed, the next step is to expand from a single signal (frequency) to a more comprehensive, multi-signal anti-spam system.

---

The app listens to message events using:
