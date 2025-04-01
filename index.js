import {extension_settings} from "../../../extensions.js";
import {saveSettingsDebounced, event_types, eventSource} from "../../../../script.js";
import { getFreeWorldEntryUid, loadWorldInfo, reloadEditor, saveWorldInfo, world_names } from "../../../world-info.js";
import { t } from "../../../i18n.js";
import { callGenericPopup, POPUP_TYPE } from "../../../popup.js";

// * Extension variables

const extensionName = "SillyTavern-WI-Bulk-Mover";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
    enabled: true,
    debug: false
};

const context = SillyTavern.getContext();

// * Debugs methods

const log = (...msg) => {
    if (!extensionSettings.enabled || !extensionSettings.debug) return;
    console.log("[" + extensionName + "]", ...msg);
};

// * Extension methods

/**
 * Moves a World Info entry from a source lorebook to a target lorebook.
 * @param {string} sourceName - The name of the source lorebook file.
 * @param {string} targetName - The name of the target lorebook file.
 * @returns {Promise<boolean>} True if the move was successful, false otherwise.
 */
async function bulkMoveWIEntries(sourceName, targetName) {
    if (sourceName === targetName) return false;

    if (!world_names.includes(sourceName)) {
        // @ts-ignore
        toastr.error(t`Source lorebook '${sourceName}' not found.`);
        log(`Source lorebook '${sourceName}' does not exist.`);
        return false;
    }

    if (!world_names.includes(targetName)) {
        // @ts-ignore
        toastr.error(t`Target lorebook '${targetName}' not found.`);
        log(`Target lorebook '${targetName}' does not exist.`);
        return false;
    }

    try {
        const sourceData = await loadWorldInfo(sourceName);
        const targetData = await loadWorldInfo(targetName);

        if (!sourceData || !sourceData.entries) {
            // @ts-ignore
            toastr.error(t`Failed to load data for source lorebook '${sourceName}'.`);
            log(`Could not load source data for '${sourceName}'.`);
            return false;
        }

        if (!targetData || !targetData.entries) {
            // @ts-ignore
            toastr.error(t`Failed to load data for target lorebook '${targetName}'.`);
            log(`Could not load target data for '${targetName}'.`);
            return false;
        }

        log("SOURCE:", sourceData, "TARGET:", targetData);

        const entryToMove = structuredClone(sourceData.entries);

        for (const key in entryToMove) {
            const entry = entryToMove[key];
            const newUid = getFreeWorldEntryUid(targetData);

            if (newUid === null) {
                log(`Failed to get a free UID in '${targetName}'.`);
                return false;
            }

            const maxDisplayIndex = Object.values(targetData.entries).reduce((max, entry) => Math.max(max, entry.displayIndex ?? -1), -1);

            entry.uid = newUid;
            entry.displayIndex = maxDisplayIndex + 1;
            targetData.entries[newUid] = entry;

            log(`Copied entry from source '${sourceName}':`, entry);
        }

        await saveWorldInfo(targetName, targetData, true);

        log(`Saved target lorebook '${targetName}'.`);

        const currentEditorBookIndex = Number($('#world_editor_select').val());

        if (!isNaN(currentEditorBookIndex)) {
            const currentEditorBookName = world_names[currentEditorBookIndex];

            if (currentEditorBookName === sourceName || currentEditorBookName === targetName)
                reloadEditor(currentEditorBookName);
        }

        return true;
    } catch (error) {

        // @ts-ignore
        toastr.error(t`An unexpected error occurred while moving the entry: ${error.message}`);
        log('Unexpected error:', error);

        return false;
    }
}

function initFeatures() {
    $('#world_apply_current_sorting').after(`
        <div id="wibm_bulk_move_wi_entries" class="menu_button fa-solid fa-boxes-packing interactable" title="Copy all entries into another lorebook" data-i18n="[title]Copy all entries into another lorebook" tabindex="0" data-wi-source="undefined"></div>
    `);

    $('#wibm_bulk_move_wi_entries').on('click', async function (e) {
        const sourceWorld = $(this).data('wi-source');

        // @ts-ignore
        if (sourceWorld === "undefined") return toastr.error(t`Select a lorebook`);

        const sourceWorldInfo = await loadWorldInfo(sourceWorld);

        if (!sourceWorldInfo) return;

        const select = document.createElement('select');
        select.id = 'wibm_bulk_move_wi_entries_select';
        select.classList.add('text_pole', 'wide100p', 'marginTop10');

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = `-- ${t`Select Target Lorebook`} --`;
        select.appendChild(defaultOption);

        let selectableWorldCount = 0;
        world_names.forEach(worldName => {
            if (worldName === sourceWorld) return;

            const option = document.createElement('option');
            option.value = world_names.indexOf(worldName).toString();
            option.textContent = worldName;
            select.appendChild(option);
            selectableWorldCount++;
        });

        if (selectableWorldCount === 0) {
            // @ts-ignore
            toastr.warning(t`There are no other lorebooks to copy into.`);
            return;
        }

        const wrapper = document.createElement('div');
        const container = document.createElement('div');

        wrapper.textContent = t`Copy "${sourceWorld}" entries into:`;
        container.appendChild(wrapper);
        container.appendChild(select);

        let selectedWorldIndex = -1;
        select.addEventListener('change', function() {
            selectedWorldIndex = this.value === '' ? -1 : Number(this.value);
        });

        const popupConfirm = await callGenericPopup(container, POPUP_TYPE.CONFIRM, '', {
            okButton: t`Copy`,
            cancelButton: t`Cancel`,
        });

        if (!popupConfirm) return;
        if (selectedWorldIndex === -1) return;

        const selectedValue = world_names[selectedWorldIndex];

        if (!selectedValue) {
            // @ts-ignore
            toastr.warning(t`Please select a target lorebook.`);
            return;
        }

        await bulkMoveWIEntries(sourceWorld, selectedValue);
    });
}

eventSource.on(event_types.WORLDINFO_UPDATED, function(...args) {
    log(args);
    $('#wibm_bulk_move_wi_entries').data('wi-source', args[0]);
});

// * Methods in charge of controlling the extension settings

const settingsCallbacks = {
    /**	Triggers on enabled setting change. */
    enabled: () => {
        // Nothing by the moment
    }
}

/** Changes a setting value and triggers a callback if there's any on settingsCallbacks. */
function settingsBooleanButton(event) {
    const target = event.target;
    const value = Boolean($(target).prop("checked"));
    const setting = target.getAttribute("wibm-setting");
    const callback = settingsCallbacks[setting];

    extensionSettings[setting] = value;

    if (callback) callback();

    log("toggleSetting " + setting, value);
    saveSettingsDebounced();
}

/**	Logs setting's values. */
function displaySettings() {
    console.debug("[" + extensionName + "]", `The extension is ${extensionSettings.enabled ? "active" : "not active"}`);
    console.debug("[" + extensionName + "]", `Debug mode is ${extensionSettings.debug ? "active" : "not active"}`);
    console.debug("[" + extensionName + "]", structuredClone(extensionSettings));
}

/** Append settings menu on ST and set listeners. */
async function loadHTMLSettings() {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

    $("#extensions_settings").append(settingsHtml);

    // Event Listeners for the extension HTML
    $("#wibm-activate-extension").on("input", settingsBooleanButton);
    $("#wibm-activate-debug").on("input", settingsBooleanButton);
    $("#wibm-check-configuration").on("click", displaySettings);

    log("loadHTMLSettings");
}

/** Init setting values on the menu */
function setSettings() {
    $("#wibm-activate-extension").prop("checked", extensionSettings.enabled).trigger("input");
    $("#wibm-activate-debug").prop("checked", extensionSettings.debug).trigger("input");

    log("setSettings", extensionSettings);
}

// * Initialize Extension

(async function initExtension() {

    if (!context.extensionSettings[extensionName]) {
        context.extensionSettings[extensionName] = structuredClone(defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (context.extensionSettings[extensionName][key] === undefined) {
            context.extensionSettings[extensionName][key] = defaultSettings[key];
        }
    }

    await loadHTMLSettings();
    setSettings();
    initFeatures();
})();
