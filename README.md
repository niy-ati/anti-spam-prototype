# Anti-Spam System for Rocket.Chat

A multi-signal, behavior-based anti-spam system built using Rocket.Chat Apps Engine.

This project focuses on detecting suspicious activity from new users by tracking behavior over time, combining multiple signals, and triggering moderation actions with clear reasoning.

---

## Overview

Instead of relying on isolated rules, this system evaluates user behavior continuously and assigns a risk score based on patterns such as:

- message bursts
- repeated content
- link usage
- suspicious domains

When the system identifies high-risk activity, it automatically moderates the message and provides a structured explanation.

---

## Key Features

- **Per-user behavioral tracking**
  - Maintains activity history independently for each user

- **Multi-signal detection**
  - Burst activity (messages in short time window)
  - Repeated messages
  - Link frequency
  - Suspicious domains (e.g. bit.ly, spam.com)

- **Risk scoring**
  - Combines signals into a normalized score (0–1)

- **Explainability**
  - Each decision includes reasons (e.g. burst activity, link spam)

- **Automated moderation**
  - Replaces suspicious messages in real-time

---

## How It Works

1. Every message triggers a post-message hook  
2. User behavior is updated and stored  
3. Signals are computed:
   - burst
   - similarity
   - link usage
   - suspicious links  
4. A risk score is calculated  
5. If threshold is exceeded:
   - message is replaced  
   - reasoning is logged  

---

## Example Output

### Moderation Trigger
# Anti-Spam System for Rocket.Chat

A multi-signal, behavior-based anti-spam system built using Rocket.Chat Apps Engine.

This project focuses on detecting suspicious activity from new users by tracking behavior over time, combining multiple signals, and triggering moderation actions with clear reasoning.

---

## Overview

Instead of relying on isolated rules, this system evaluates user behavior continuously and assigns a risk score based on patterns such as:

- message bursts
- repeated content
- link usage
- suspicious domains

When the system identifies high-risk activity, it automatically moderates the message and provides a structured explanation.

---

## Key Features

- **Per-user behavioral tracking**
  - Maintains activity history independently for each user

- **Multi-signal detection**
  - Burst activity (messages in short time window)
  - Repeated messages
  - Link frequency
  - Suspicious domains (e.g. bit.ly, spam.com)

- **Risk scoring**
  - Combines signals into a normalized score (0–1)

- **Explainability**
  - Each decision includes reasons (e.g. burst activity, link spam)

- **Automated moderation**
  - Replaces suspicious messages in real-time

---

## How It Works

1. Every message triggers a post-message hook  
2. User behavior is updated and stored  
3. Signals are computed:
   - burst
   - similarity
   - link usage
   - suspicious links  
4. A risk score is calculated  
5. If threshold is exceeded:
   - message is replaced  
   - reasoning is logged  

---

## Example Output
```text

🚫 Moderation triggered: {
username: "spammer",
userId: "abc123"
}

```
### Risk Analysis

```text

🚨 Risk Analysis: {
score: 0.8,
reasons: [
"burst activity (5 msgs/10s)",
"suspicious link detected"
]
}
```

### Moderation Trigger

---

## Demo Scenarios Tested

The system was validated using multiple users:

### Normal Behavior
- regular conversation → no flags

### Burst Activity
- rapid messages → detected as burst signal

### Link Spam
- repeated suspicious links → message removed

### Multi-user Isolation
- normal users unaffected  
- only malicious user moderated  


---

## Setup

```text

### 1. Install dependencies
npm install

### 2. Package the app

rc-apps package


### 3. Deploy to Rocket.Chat
rc-apps deploy --url http://localhost:3000
 -u <username> -p <password>

```
---

## Design Decisions

- Detection is lightweight and runs in the post-message hook  
- State is stored using Rocket.Chat persistence associations  
- Moderation is applied only after signal aggregation  
- Logging is structured for debugging and explainability  

---

## Future Improvements

- asynchronous scoring and aggregation  
- admin dashboard for flagged users  
- advanced similarity detection  
- cross-channel behavior tracking  
- ML-based classification  

---

## Purpose

This project was built to explore how behavioral analysis and explainable moderation can be integrated into Rocket.Chat in a practical and extensible way.

---

## Author

Niyati Jain

---

