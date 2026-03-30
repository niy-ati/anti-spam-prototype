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
};

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

        console.log("🔥 Hook triggered for user:", userId);

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
        };

        if (existing.length > 0) {
    const prev = existing[0] as any;

    state = {
        timestamps: prev.timestamps || [],
        lastMessages: prev.lastMessages || [],
        linkCount: prev.linkCount || 0,
        score: prev.score || 0,
    };
}

        state.timestamps.push(now);

        if (state.timestamps.length > 10) {
            state.timestamps.shift();
        }

        const recent = state.timestamps.filter(t => now - t < 10000);
        const burstSignal = recent.length >= 5 ? 1 : 0;

        const similarCount = state.lastMessages.filter(m => m === text).length;
        const similaritySignal = similarCount >= 2 ? 1 : 0;

        state.lastMessages.push(text);

        if (state.lastMessages.length > 5) {
            state.lastMessages.shift();
        }

        //link extraction

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const links = text.match(urlRegex) || [];

        if (links.length > 0) {
            state.linkCount += links.length;
        }

        //suspicious link detection
        
        const suspiciousDomains = ["bit.ly", "tinyurl.com", "spam.com"];

        let suspiciousLinkDetected = false;

        links.forEach(link => {
            try {
                let domain = new URL(link).hostname.toLowerCase();

                domain = domain.replace("www.", "");

                if (suspiciousDomains.includes(domain)) {
                    suspiciousLinkDetected = true;
                }
            } catch (e) {}
        });

        const linkSignal = state.linkCount >= 2 ? 1 : 0;


        let score = 0;

        if (burstSignal) score += 0.4;
        if (similaritySignal) score += 0.2;
        if (linkSignal) score += 0.2;
        if (suspiciousLinkDetected) score += 0.3;

        state.score = Math.min(score, 1);

        const reasons: string[] = [];

        if (burstSignal) {
            reasons.push(`burst activity (${recent.length} msgs/10s)`);
        }

        if (similaritySignal) {
            reasons.push(`repeated messages (${similarCount})`);
        }

        if (linkSignal) {
            reasons.push(`link frequency (${state.linkCount})`);
        }

        if (suspiciousLinkDetected) {
            reasons.push("suspicious link detected");
        }
        console.log("DEBUG:", {
            links,
            suspiciousLinkDetected,
            score: state.score
        });
        await persistence.updateByAssociation(
            association,
            state,
            true
        );

if (suspiciousLinkDetected || state.score >= 0.5) {

    console.log("🚨 Moderation Event:", {
    user: {
        username: message.sender.username,
        name: message.sender.name,
        userId: message.sender.id,
    },
    message: message.text,
    score: state.score,
});

    if (!message.id) return;

    const updater = modify.getUpdater();

if (!message.id) return;

const builder = await updater.message(message.id, message.sender);

builder.setText("[Message removed: suspected spam]");

await updater.finish(builder);
    
}

        if (state.score >= 0.5) {
            console.log("🚨 Risk Analysis:", {
                userId,
                score: state.score,
                reasons
            });
        }
    }}
