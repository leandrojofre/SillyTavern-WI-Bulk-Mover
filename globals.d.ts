/// <reference path="../../../../global.d.ts" />

import {t} from "../../../i18n";

export {};

declare global {
    type PopupOptions = import('../../../popup.js').PopupOptions;

    type WIBulkMoverInterface = {
        log: (...mess: any[]) => void;
        debug: (...mess: any[]) => void;
        error: (...mess: any[]) => void;
    };

    type ExtensionSettings = {
        debug: boolean;
    };

    type EventData<T> = Event & {
        data: Record<string, any>;
        currentTarget: T;
    };

    type CursorEventData<T> = MouseEvent & {
        data: Record<string, any>;
        currentTarget: T;
    };

    namespace globalThis {
        var WiBulkMover: WIBulkMoverInterface;
    }
};