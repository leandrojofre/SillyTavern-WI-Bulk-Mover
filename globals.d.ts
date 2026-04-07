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