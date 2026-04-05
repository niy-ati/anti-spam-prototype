import {
    IAppAccessors,
    ILogger,
    IRead,
    IModify,
    IHttp,
    IPersistence,
} from '@rocket.chat/apps-engine/definition/accessors';

import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';

import {
    IPostMessageSent,
    IMessage,
} from '@rocket.chat/apps-engine/definition/messages';

import {
    RocketChatAssociationModel,
    RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';

//types

type UserState = {
    timestamps: number[];
    lastMessages: string[];
    linkCount: number;
    score: number;
    state: string;
    roomHistory: { roomId: string; time: number }[];
    cleanStreak: number;
    createdAt: number;
    reasons: string[];
    flagged: boolean;
    aiTriggered?: boolean;
   aiSummary?: string;
    riskHistory: number[];
    lastActive: number;
    aiConfidence?: string;
    dailyStats?: {
    flaggedCount: number;
    lastReset: number;
};
};

const CONFIG = {
    BURST_LIMIT: 5,
    SIMILAR_LIMIT: 2,
    LINK_LIMIT: 2,

    NEW_USER_WINDOW: 1000 * 60 * 60 * 24 * 42, // 6 weeks

    SCORE_WEIGHTS: {
        burst: 10,
        similarity: 10,
        link: 10,
        suspicious: 25,
        crossRoom: 15,
    },
};

const SUSPICIOUS_DOMAINS = ["bit.ly", "tinyurl.com", "spam.com"];

function normalize(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

// lightweight cosine like similarity
function similarityScore(a: string, b: string): number {
    const setA = new Set(normalize(a).split(" "));
    const setB = new Set(normalize(b).split(" "));

    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;

    return union === 0 ? 0 : intersection / union;
}

// signal extraction

function extractSignals(state: UserState, text: string, now: number) {

    const recent = state.timestamps.filter(t => now - t < 10000);
    const burst = recent.length >= CONFIG.BURST_LIMIT;

    const similarCount = state.lastMessages.filter(m =>
    text.length > 10 && similarityScore(m, text) > 0.8
).length;

    const similarity = similarCount >= CONFIG.SIMILAR_LIMIT;

    const links = text.match(/https?:\/\/[^\s]+/g) || [];

    if (links.length > 0) state.linkCount += links.length;

    let suspicious = false;
    links.forEach(link => {
        try {
            const domain = new URL(link).hostname.replace("www.", "");
            if (SUSPICIOUS_DOMAINS.includes(domain)) suspicious = true;
        } catch {}
    });

    const link = links.length >= CONFIG.LINK_LIMIT && state.linkCount >= 3;

    const uniqueRooms = new Set(state.roomHistory.map(r => r.roomId));
    const crossRoom = uniqueRooms.size >= 3 && recent.length >= 3;
    const joinVelocity = state.roomHistory.length >= 5;
    const lowDiversity =
    state.lastMessages.length >= 3 &&
    state.lastMessages.every(m => m.includes("http"));
    const mentionCount = (text.match(/@\w+/g) || []).length;
    const totalWords = text.split(" ").length || 1;
    const mentionRatio = mentionCount / totalWords;
    const linkDomains = links.map(link => {
    try {
        return new URL(link).hostname.replace("www.", "");
    } catch {
        return "";
    }
});

const repeatedDomain =
    linkDomains.length > 0 &&
    linkDomains.every(d => d === linkDomains[0]);
    return {
        burst,
        similarity,
        link,
        suspicious,
        crossRoom,
        joinVelocity,
        recentCount: recent.length,
        similarCount,
        lowDiversity,
        roomSpread: uniqueRooms.size,
        mentionRatio,
        repeatedDomain,
    };
}

// scoring engine

function computeScore(signals: any) {
    let score = 0;

    if (signals.burst) score += CONFIG.SCORE_WEIGHTS.burst;
    if (signals.similarity) score += CONFIG.SCORE_WEIGHTS.similarity;
    if (signals.suspicious) score += CONFIG.SCORE_WEIGHTS.suspicious;
    if (signals.link) score += CONFIG.SCORE_WEIGHTS.link;
    if (signals.joinVelocity) score += 10;
    if (signals.crossRoom) score += CONFIG.SCORE_WEIGHTS.crossRoom;
    if (signals.lowDiversity) score += 8;
    if (signals.mentionRatio > 0.3) score += 5;
    if (signals.repeatedDomain) score += 8;

    return score;
}


function getState(score: number): string {
    if (score >= 80) return "RESTRICTED";
    if (score >= 60) return "COOLDOWN";
    if (score >= 40) return "WARNING";
    return "NORMAL";
}

// reasoning layer

function generateReasons(signals: any): string[] {
    const reasons: string[] = [];

    if (signals.burst)
        reasons.push(`High activity (${signals.recentCount}/10s)`);

    if (signals.similarity)
        reasons.push(`Repeated messages (${signals.similarCount})`);

    if (signals.link)
        reasons.push(`Frequent links`);

    if (signals.suspicious)
        reasons.push(`Suspicious domain`);

    if (signals.crossRoom)
        reasons.push(`Cross-room spam (${signals.roomSpread})`);
    if (signals.joinVelocity)
    reasons.push(`Rapid room activity`);

if (signals.lowDiversity)
    reasons.push(`Low content diversity (link-heavy behavior)`);
if (signals.mentionRatio > 0.3)
    reasons.push(`High mention ratio`);

if (signals.repeatedDomain)
    reasons.push(`Repeated link domain pattern`);
    return reasons;
}

//message quality check

function isSpamLikeMessage(text: string, signals: any): boolean {
    if (signals.burst || signals.similarity || signals.suspicious) return true;

    const lowContent = text.trim().length < 5;
    const manyLinks = (text.match(/https?:\/\//g) || []).length > 1;

    return lowContent || manyLinks;
}

// async hook

async function triggerAIAnalysis(
    userId: string,
    text: string,
    state: any,
    http: IHttp,
    logger: ILogger
): Promise<void> {
    try {
        // only trigger for high-risk users (avoid spam calls)
        if (state.score < 60 || state.aiTriggered || state.cleanStreak >= 3) return;

        // example payload (safe + minimal)
        const payload = {
            userId,
            message: text,
            score: state.score,
            state: state.state,
            reasons: state.reasons,
        };

        // this is a placeholder used for demo but in actual this would connect to an AI service(FastAPI / Node microservice / Groq / OpenAI proxy)
       const response = await http.post("https://example-ai-endpoint.com/analyze", {
    data: payload,
});

if (response && response.data) {
    state.aiSummary = response.data.summary || "";
    state.aiConfidence = response.data.confidence || "medium";
}

        logger.debug("🤖 AI Analysis Response:", response?.data);

    } catch (err) {
        logger.error("AI Hook Failed:", err);
    }
}


export class AntiSpamPrototypeApp extends App implements IPostMessageSent {

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<void> {

        const userId = message.sender.id;
        const now = Date.now();
        const text = message.text || "";
        const roomId = message.room.id;

        const association = new RocketChatAssociationRecord(
            RocketChatAssociationModel.USER,
            userId
        );

        const existing = await read.getPersistenceReader().readByAssociation(association);

        let state: UserState = {
            timestamps: [],
            lastMessages: [],
            linkCount: 0,
            score: 0,
            state: "NORMAL",
            roomHistory: [],
            cleanStreak: 0,
            createdAt: now,
            reasons: [],
            flagged: false,
            aiTriggered: false,
            aiSummary: "",
            riskHistory: [],
            lastActive: now,
};
        

        if (existing.length > 0) state = existing[0] as UserState;

        // new user check

        if (now - state.createdAt > CONFIG.NEW_USER_WINDOW) {
            return; // only monitor new users
        }
        // inactive users reset
if (!state.lastActive) state.lastActive = now;

if (now - state.lastActive > 1000 * 60 * 60 * 24 * 7) {
    state.score = 0;
    state.cleanStreak = 0;
    state.state = "NORMAL";
    state.reasons = [];
}

       // update state
        state.timestamps.push(now);
        if (state.timestamps.length > 10) state.timestamps.shift();

        state.lastMessages.push(text);
        if (state.lastMessages.length > 5) state.lastMessages.shift();

        state.roomHistory.push({ roomId, time: now });
        state.roomHistory = state.roomHistory.filter(r => now - r.time < 120000);

        state.lastActive = now;

        const signals = extractSignals(state, text, now);

      //scoring
        const addedScore = computeScore(signals);
        state.score = Math.min(state.score + addedScore, 100);
        // daily report tracking 
        if (!state.dailyStats) {
            state.dailyStats = { flaggedCount: 0, lastReset: now };
        }
        if (now - state.dailyStats.lastReset > 1000 * 60 * 60 * 24) {
            state.dailyStats.flaggedCount = 0;
            state.dailyStats.lastReset = now;
        }

        if (state.score >= 60) {
            state.dailyStats.flaggedCount += 1;
}
        state.riskHistory.push(state.score);
if (state.riskHistory.length > 10) state.riskHistory.shift();
        // Admin flagging
state.flagged = state.score >= 60;
        const spamMessage = isSpamLikeMessage(text, signals);

        // recovery engine
        if (!spamMessage) {
    state.cleanStreak += 1;

    // base recovery
    state.score = Math.max(state.score - 10, 0);

    // trust recovery boost
    if (state.cleanStreak >= 3) {
        state.score = Math.max(state.score - 20, 0);
    }

    // strong recovery
    if (state.cleanStreak >= 5) {
        state.score = Math.max(state.score - 30, 0);
    }

} else {
    state.cleanStreak = 0;
}

// Prevent negative oscillation
state.score = Math.max(state.score, 0);

    // state transition

state.state = getState(state.score);

// anti-flapping tolerance
if (state.state === "WARNING" && state.score < 35) {
    state.state = "NORMAL";
}

// score based exit condition
if (state.state === "RESTRICTED" && state.score < 70) {
    state.state = "COOLDOWN";
}

// exit RESTRICTED faster if behavior improves
if (state.state === "RESTRICTED" && state.cleanStreak >= 3) {
    state.state = "COOLDOWN";
}

// Exit COOLDOWN if consistently clean
if (state.state === "COOLDOWN" && state.cleanStreak >= 5) {
    state.state = "NORMAL";
}

        state.reasons = generateReasons(signals);

        console.log("📊 Moderation:", {
            userId,
            score: state.score,
            state: state.state,
            reasons: state.reasons
        });

if (state.score >= 60) {
    console.log("📈 REPORT:", {
    userId,
    score: state.score,
    state: state.state,
    reasons: state.reasons,
    aiConfidence: state.aiConfidence || "N/A"
});
}
       // moderation

if (state.state === "NORMAL") {
    await persistence.updateByAssociation(association, state, true);
    return;
}
if (state.state === "WARNING" && addedScore > 0) {

    const notifier = modify.getNotifier();

    const warningText =
        state.cleanStreak === 0
            ? "⚠️ Suspicious activity detected. Please adjust behavior."
            : "⚠️ Please continue normal behavior to avoid restrictions.";

    await notifier.notifyUser(message.sender, {
        room: message.room,
        sender: message.sender,
        text: warningText,
    });
}

if (state.state === "COOLDOWN") {
    console.log("⏳ Cooldown active:", userId);
}

if (state.state === "RESTRICTED") {

    // AI HOOK
   triggerAIAnalysis(userId, text, state, http, this.getLogger())
   .then(async () => {
    state.aiTriggered = true;

    // re-fetch latest state before saving to prevent overwrite
    const latest = await read.getPersistenceReader().readByAssociation(association);
    if (latest.length > 0) {
        const latestState = latest[0] as UserState;

        latestState.aiTriggered = true;
        latestState.aiSummary = state.aiSummary;
        latestState.aiConfidence = state.aiConfidence;

        await persistence.updateByAssociation(association, latestState, true);
    }
})
    .catch(() => {});

    if (spamMessage) {
        const updater = modify.getUpdater();
        const builder = await updater.message(message.id!, message.sender);

        builder.setText("[Blocked: repeated spam-like behavior. Please adjust activity.]");
        await updater.finish(builder);
    } else {
        state.score = Math.max(state.score - 20, 0);
        console.log("🟢 Clean message allowed in restricted state:", userId);
    }
}

// -------------------------------
// FINAL STATE SAVE (VERY IMPORTANT)
// -------------------------------
await persistence.updateByAssociation(association, state, true);
