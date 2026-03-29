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

        // 🔥 Debug log to confirm hook execution
        console.log("🔥 Hook triggered for user:", message.sender.id);

        const userId = message.sender.id;
        const now = Date.now();

        const association = new RocketChatAssociationRecord(
            RocketChatAssociationModel.USER,
            userId
        );

        // ✅ Correct way for v1.41 API
        const existing = await read.getPersistenceReader().readByAssociation(association);

        let timestamps: number[] = [];

        // ✅ Safe extraction
        if (existing.length > 0) {
            const data = existing[0] as any;
            timestamps = data.timestamps || [];
        }

        // Add current timestamp
        timestamps.push(now);

        // Keep last 10
        if (timestamps.length > 10) {
            timestamps.shift();
        }

        // Save
        await persistence.updateByAssociation(
            association,
            { timestamps },
            true
        );

        // Detect burst (5 messages in 10 sec)
        const recent = timestamps.filter(t => now - t < 10000);

        if (recent.length >= 5) {
            console.log(`⚠️ Burst detected for user ${userId}`);
        }
    }
}