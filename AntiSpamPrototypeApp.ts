// FULL CLEAN VERSION (FINAL)

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

type UserState = {
    timestamps: number[];
    lastMessages: string[];
    linkCount: number;
    score: number;
    state: string;
    roomHistory: { roomId: string; time: number }[];
};

const CONFIG = {
    BURST_LIMIT: 5,
    SIMILAR_LIMIT: 2,
    LINK_LIMIT: 2,

    SCORE_WEIGHTS: {
        burst: 10,
        similarity: 10,
        link: 10,
        suspicious: 25,
        crossRoom: 15,
    },
};

const SUSPICIOUS_DOMAINS = ["bit.ly", "tinyurl.com", "spam.com"];

// ---------------- SIGNALS ----------------

function extractSignals(state: UserState, text: string, now: number) {
    const recent = state.timestamps.filter(t => now - t < 10000);
    const burst = recent.length >= CONFIG.BURST_LIMIT;

    const similarCount = state.lastMessages.filter(m => m === text).length;
    const similarity = similarCount >= CONFIG.SIMILAR_LIMIT;

    const links = text.match(/(https?:\/\/[^\s]+)/g) || [];

    if (links.length > 0) {
        state.linkCount += links.length;
    }

    let suspicious = false;

    links.forEach(link => {
        try {
            const domain = new URL(link).hostname.replace("www.", "");
            if (SUSPICIOUS_DOMAINS.includes(domain)) {
                suspicious = true;
            }
        } catch {}
    });

    const link = links.length >= CONFIG.LINK_LIMIT && state.linkCount >= 3;

    const uniqueRooms = new Set(state.roomHistory.map(r => r.roomId));
    const crossRoom = uniqueRooms.size >= 2;

    return { burst, similarity, link, suspicious, crossRoom };
}

// ---------------- SCORING ----------------

function computeScore(signals: any) {
    let score = 0;

    if (signals.burst) score += CONFIG.SCORE_WEIGHTS.burst;
    if (signals.similarity) score += CONFIG.SCORE_WEIGHTS.similarity;
    if (signals.suspicious) score += CONFIG.SCORE_WEIGHTS.suspicious;
    else if (signals.link) score += CONFIG.SCORE_WEIGHTS.link;

    if (signals.crossRoom) score += CONFIG.SCORE_WEIGHTS.crossRoom;

    return score;
}

function getState(score: number) {
    if (score >= 80) return "RESTRICTED";
    if (score >= 60) return "COOLDOWN";
    if (score >= 40) return "WARNING";
    return "NORMAL";
}

// ---------------- HELPERS ----------------

function isClean(signals: any) {
    return !signals.burst &&
           !signals.similarity &&
           !signals.link &&
           !signals.suspicious &&
           !signals.crossRoom;
}

function shouldBlock(signals: any, state: string) {
    return state === "RESTRICTED" && (
        signals.burst ||
        signals.similarity ||
        signals.suspicious ||
        signals.link
    );
}

// ---------------- MAIN APP ----------------

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
        };

        if (existing.length > 0) {
            state = existing[0] as UserState;
        }

        // ---------- UPDATE STATE ----------
        state.timestamps.push(now);
        if (state.timestamps.length > 10) state.timestamps.shift();

        state.lastMessages.push(text);
        if (state.lastMessages.length > 5) state.lastMessages.shift();

        state.roomHistory.push({ roomId, time: now });
        state.roomHistory = state.roomHistory.filter(r => now - r.time < 120000);

        // ---------- SIGNALS ----------
        const signals = extractSignals(state, text, now);

        // ---------- SCORE ----------
        const added = computeScore(signals);
        state.score = Math.min(state.score + added, 100);

        if (isClean(signals)) {
            state.score = Math.max(state.score - 15, 0);
        }

        state.state = getState(state.score);

        console.log("📊 Risk:", {
            userId,
            score: state.score,
            state: state.state,
            signals
        });

        await persistence.updateByAssociation(association, state, true);

        // ---------- MODERATION ----------
        if (state.state === "WARNING") {
            await modify.getNotifier().notifyUser(message.sender, {
                room: message.room,
                sender: message.sender,
                text: "⚠️ Please avoid spam-like behavior."
            });
        }

        if (shouldBlock(signals, state.state)) {
            if (!message.id) return;

            const updater = modify.getUpdater();
            const builder = await updater.message(message.id, message.sender);

            builder.setText("[Message blocked: repeated spam behavior]");

            await updater.finish(builder);
        }
    }
}