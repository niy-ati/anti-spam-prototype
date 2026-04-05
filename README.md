# Anti-Spam System for Rocket.Chat

A multi-signal, behavior-based anti-spam system built using Rocket.Chat Apps Engine.

This project focuses on detecting suspicious activity from new users by tracking behavior over time, combining multiple signals, and triggering moderation actions with clear reasoning.

---

## Demo

This project has been validated with real multi-user scenarios.

Video recordings demonstrating:  
normal vs spam behavior  
burst detection  
link-based moderation  
multi-user isolation  
recovery behavior (restricted → normal)  
AI-assisted explainability  

**Demo videos:**  
[Drive link to access demo videos](https://drive.google.com/drive/folders/1MoSUZ8LxrwFIq27bEE3Y4wnaDkjZD1Px?usp=sharing)

---

## Overview

Instead of relying on isolated rules, this system evaluates **user behavior continuously** and assigns a dynamic risk score based on patterns such as:

- message bursts  
- repeated content  
- link usage  
- suspicious domains  
- cross-room activity  
- mention abuse  
- repeated link propagation  

The system applies **progressive moderation with recovery**, ensuring fairness while maintaining strong protection against spam.

When high-risk activity is detected, the system:
- moderates the message  
- logs structured reasoning  
- optionally triggers AI-based analysis  

---

## Key Features

### **Per-user behavioral tracking**
- Maintains independent state for each user  
- Tracks message history, timestamps, and room activity  

### **Multi-signal detection**
- Burst activity (rapid messages)  
- Repeated messages (similarity detection)  
- Link frequency and density  
- Suspicious domains (e.g. bit.ly, spam.com)  
- Cross-room spam behavior  
- Join velocity (rapid room activity)  
- Low content diversity (link-heavy behavior)  
- Mention ratio detection (targeted spam)  
- Repeated domain propagation (polymorphic spam)  

### **Behavioral risk scoring**
- Weighted scoring system (0–100)  
- Tracks risk trends over time (`riskHistory`)  
- Designed for consistency, not spikes  

### **Progressive moderation system**
- NORMAL → no action  
- WARNING → user notified  
- COOLDOWN → monitored behavior  
- RESTRICTED → conditional blocking  

### **Recovery & trust system (key innovation)**
- Clean behavior reduces score  
- Trust-based recovery (clean streak)  
- Users can exit restriction dynamically  
- Prevents long-term penalization  

### **Explainability layer**
- Structured reasons for every decision  
- Signal-based reasoning (e.g. burst, similarity, domain)  
- Logs for debugging and transparency  

### **AI-assisted moderation (async, non-blocking)**
- Triggered only for high-risk users  
- Generates summary + confidence  
- Stored in user state (`aiSummary`, `aiConfidence`)  
- Uses safe placeholder endpoint for demo  

### **Reporting layer**
- Daily flagged user tracking  
- Rolling risk statistics  
- Supports future dashboard integration  

### **Multi-user safe architecture**
- Fully isolated per-user state  
- Persistence-based (Apps Engine compliant)  
- Safe for distributed environments  

---

## How It Works

1. Every message triggers a post-message hook  
2. User state is updated and persisted  
3. Signals are computed:
   - burst  
   - similarity  
   - link usage  
   - suspicious domains  
   - cross-room activity  
   - mention ratio  
   - repeated domain patterns  

4. A behavioral risk score is calculated  
5. State transitions dynamically:
   - NORMAL → WARNING → COOLDOWN → RESTRICTED  

6. Recovery logic applies:
   - clean messages reduce score  
   - restriction is lifted if behavior improves  

7. If high-risk:
   - message is conditionally blocked  
   - reasoning is logged  
   - AI analysis is triggered (async)  

---

## Example Output

### Moderation Trigger

```text
🚫 Moderation triggered: {
  username: "spammer",
  userId: "abc123"
}
```

### Risk Analysis
```text
🚨 Risk Analysis: {
  score: 82,
  state: "RESTRICTED",
  reasons: [
    "High activity (6/10s)",
    "Repeated messages (3)",
    "Suspicious domain",
    "Repeated link domain pattern"
  ],
  aiConfidence: "high"
}

```
## Demo Scenarios Tested

### Normal Behavior
- regular conversation → no flags  

### Burst Activity
- rapid messages → detected and escalated  

### Link Spam
- repeated suspicious links → blocked  

### Recovery Behavior
- user sends clean messages → restriction lifted  

### Multi-user Isolation
- only malicious users are affected  
- normal users remain unaffected  

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Package the app
rc-apps package

# 3. Deploy to Rocket.Chat
rc-apps deploy --url http://localhost:3000 \
-u <username> -p <password>
```
---

## Design Decisions
- Detection is lightweight and runs in post-message hook
- State is stored using Rocket.Chat persistence associations
- Moderation decisions are behavior-driven, not message-based
- Recovery is integrated to reduce false positives
- AI layer is async and non-blocking
- System is designed to degrade gracefully

---

## Architecture Highlights
- Behavioral state model per user
- Multi-signal aggregation
- Deterministic scoring engine
- Progressive enforcement with recovery
- Explainability-first design
- AI-assisted reasoning layer
- Reporting and analytics readiness

---

## Future Improvements
- Admin dashboard for real-time monitoring
/antispam admin commands (status, analyze, reset)
- RAG-based AI explanations
- advanced similarity (MinHash / embeddings)
- mention targeting analysis
- anomaly detection layer
- cross-instance aggregation

---

## Purpose

This project explores how behavioral intelligence, recovery-aware moderation, and explainability can be combined to build scalable trust & safety systems within Rocket.Chat.

Author

Niyati Jain


---


