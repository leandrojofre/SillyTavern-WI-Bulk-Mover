import {extension_settings} from "../../../extensions.js";
import {saveSettingsDebounced} from "../../../../script.js";
import { getFreeWorldEntryUid, loadWorldInfo, reloadEditor, saveWorldInfo, world_names, moveWorldInfoEntry, deleteWorldInfoEntry, deleteWIOriginalDataValue } from "../../../world-info.js";
import { t } from "../../../i18n.js";
import { callGenericPopup, POPUP_TYPE } from "../../../popup.js";

// * Extension variables

const extensionName = "SillyTavern-WI-Bulk-Mover";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
    debug: false
};

const context = SillyTavern.getContext();

// * Debugs methods

const log = (...msg) => {
    if (!extensionSettings.debug) return;
    console.log("[" + extensionName + "]", ...msg);
};

// * Extension methods

/**
    Clones World Info entries from a source lorebook to a target lorebook.
    @param {string} sourceName - The name of the source lorebook file.
    @param {string} targetName - The name of the target lorebook file.
    @param {Array} sourceEntries - The entries of the source lorebook file.
    @returns {Promise<boolean>} True if the move was successful, false otherwise.
*/
async function bulkCloneWIEntries(sourceName, targetName, sourceEntries) {
    try {
        if (sourceName === targetName) throw new Error(`Target lorebook must not be the same than source`);
        if (!world_names.includes(targetName)) throw new Error(`Target lorebook '${targetName}' not found`);
        if (!sourceEntries?.length) throw new Error(`Lorebook '${sourceName}' has no entries`);

        const targetData = await loadWorldInfo(targetName);

        if (!targetData || !targetData.entries) throw new Error(`Failed to load data for target lorebook '${targetName}'`);

        log("SOURCE:", sourceEntries, "TARGET:", targetData);

        let maxDisplayIndex = Object
            .values(targetData.entries)
            .reduce((max, entry) => Math.max(max, entry.displayIndex ?? -1), -1);

        for (const entry of sourceEntries) {
            const newUid = getFreeWorldEntryUid(targetData);

            if (newUid === null) throw new Error(`Failed to get a free UID in '${targetName}'`);

            maxDisplayIndex++
            entry.uid = newUid;
            entry.displayIndex = maxDisplayIndex;
            targetData.entries[newUid] = entry;

            log(`Copied entry from source '${sourceName}':`, entry);
        }

        await saveWorldInfo(targetName, targetData, true);

        const currentEditorBookIndex = Number($('#world_editor_select').val());

        if (!isNaN(currentEditorBookIndex)) {
            const currentEditorBookName = world_names[currentEditorBookIndex];

            if (currentEditorBookName === sourceName || currentEditorBookName === targetName)
                reloadEditor(currentEditorBookName);
        }

        // @ts-ignore
        toastr.success(t`Selected entries were copied from '${sourceName}' into '${targetName}' successfully`);

        return true;
    } catch (error) {

        // @ts-ignore
        toastr.error(t`Unexpected error: ${error.message}`);
        log('Unexpected error:', error);

        return false;
    }
}

/**
    Transfers World Info entries from a source lorebook to a target lorebook.
    @param {string} sourceName - The name of the source lorebook file.
    @param {string} targetName - The name of the target lorebook file.
    @param {Array} sourceEntries - The entries of the source lorebook file.
    @returns {Promise<boolean>} True if the move was successful, false otherwise.
*/
async function bulkTransferWIEntries(sourceName, targetName, sourceEntries) {
    try {
        if (!sourceEntries?.length) throw new Error(`Lorebook '${sourceName}' has no entries`);

        for (const entry of sourceEntries) {
            const moved = await moveWorldInfoEntry(sourceName, targetName, entry.uid);

            if (!moved) throw new Error(`Failed to move entry with uid ${entry.uid}`);
        }

        // @ts-ignore
        toastr.success(t`Selected entries were transferred from '${sourceName}' into '${targetName}' successfully`);

        return true;
    } catch (error) {

        // @ts-ignore
        toastr.error(t`Unexpected error: ${error.message}`);
        log('Unexpected error:', error);

        return false;
    }
}

/**
    Deletes multiple entries from a World Info.
    @param {String} sourceName - The name of the source lorebook file.
    @param {Array} sourceEntries - The entries of the source lorebook file.
    @returns {Promise<boolean>} True if the move was successful, false otherwise.
*/
async function bulkDeleteWIEntries(sourceName, sourceEntries) {
    try {
        if (!sourceEntries?.length) throw new Error(`Lorebook '${sourceName}' has no entries`);

        /** Create delete popup container and title. */
        const wrapper = document.createElement("div");
        const container = document.createElement("div");

        wrapper.innerHTML = t`Are you sure you want to delete lorebook entries from ` + `<span style="font-weight: bold;">'${sourceName}'</span>?`;
        container.appendChild(wrapper);

        const popupConfirm = await callGenericPopup(container, POPUP_TYPE.CONFIRM, "", {
            okButton: t`Yes`,
            cancelButton: t`Cancel`,
        });

        // @ts-ignore
        if (popupConfirm !== 1) throw new Error(`Entries deletion cancelled`);

        const sourceData = await loadWorldInfo(sourceName);

        for (const entry of sourceEntries) {
            const uid = entry.uid;
            const deleted = await deleteWorldInfoEntry(sourceData, uid, { silent: true });

            if (!deleted) throw new Error(`Failed to delete entry with uid ${uid}`);

            deleteWIOriginalDataValue(sourceData, uid);
        }

        await saveWorldInfo(sourceName, sourceData, true);

        reloadEditor(sourceName);

        // @ts-ignore
        toastr.success(t`Selected entries from '${sourceName}' were deleted successfully`);

        return true;
    } catch (error) {

        // @ts-ignore
        toastr.error(t`Unexpected error: ${error.message}`);
        log('Unexpected error:', error);

        return false;
    }
}

/**
    Creates Popup for World Info
    @param {String} sourceWorld
    @param {Object} sourceWorldEntries
    @returns {Promise<Object>|null}
*/
async function createBulkMoverPopup(sourceWorld, sourceWorldEntries) {
    /** Create popup buttons. */
    const WISourceDefaultOption = document.createElement("option");
    WISourceDefaultOption.value = "";
    WISourceDefaultOption.textContent = `-- ${t`Select Target Lorebook`} --`;

    const selectWISource = document.createElement("select");
    selectWISource.id = "wibm_bulk_move_wi_select";
    selectWISource.classList.add("text_pole", "wide100p", "marginTop10");
    selectWISource.appendChild(WISourceDefaultOption);

    /** Give WI selector options. */
    let selectableWorldCount = 0;
    world_names.forEach(worldName => {
        if (worldName === sourceWorld) return;

        const option = document.createElement("option");
        option.value = world_names.indexOf(worldName).toString();
        option.textContent = worldName;
        selectWISource.appendChild(option);
        selectableWorldCount++;
    });

    // @ts-ignore
    if (selectableWorldCount === 0) return toastr.warning(t`There are no other lorebooks to transfer into`);

    const selectSourceEntries =  document.createElement("select");
    selectSourceEntries.id = "wibm_bulk_move_wi_select_entries";
    selectSourceEntries.classList.add("wide100p", "marginTop20", "select2_multi_sameline", "select2_choice_clickable", "select2_choice_clickable_buttonstyle");
    selectSourceEntries.name = "wibm-source-entries[]";
    selectSourceEntries.setAttribute("multiple", "multiple");

    /** Give WI entries selector options. */
    const sourceEntriesDefaultOption = { id: -1, text: t`All` };
    const entriesData = [];

    for (const key in sourceWorldEntries) {
        const entry = sourceWorldEntries[key];
        let dataName = entry.comment;

        if (dataName === "") {
            if (entry.key.length > 0) dataName = entry.key[0];
            else if (entry.content.length > 0) dataName = entry.content.slice(0, entry.content.length >= 25 ? 25 : entry.content.length).replace(/\n/g, " ") + "...";
            else dataName = "UID: " + entry.uid;
        }

        entriesData.push({ id: entry.uid, text: dataName, order: entry.displayIndex });
    }

    let selectedWorldIndex = -1;
    let selectedWorldEntries = ["-1"];

    $(selectSourceEntries).on('change', function(e) {
        const newVal = $(this).val();

        // @ts-ignore
        if (newVal.includes("-1") && !selectedWorldEntries.includes("-1")) {
            /** If selected All, remove other selections. */
            selectedWorldEntries = ["-1"];
            $(selectSourceEntries).val(selectedWorldEntries);
            $(selectSourceEntries).trigger('change');
            log("selectSourceEntries.on(change)", selectedWorldEntries);
            return
        }

        // @ts-ignore
        if (newVal.includes("-1") && newVal.length > 1) {
            /** If selected an entry, remove selection of All. */
            // @ts-ignore
            selectedWorldEntries = newVal.filter((uid) => uid !== "-1");
            $(selectSourceEntries).val(selectedWorldEntries);
            $(selectSourceEntries).trigger('change');
            log("selectSourceEntries.on(change)", selectedWorldEntries);
            return
        }

        // @ts-ignore
        selectedWorldEntries = newVal;

        log("selectSourceEntries.on(change)", selectedWorldEntries);
    });

    /** Create popup container and title. */
    const wrapper = document.createElement("div");
    const container = document.createElement("div");

    wrapper.textContent = t`Copy "${sourceWorld}" entries into:`;
    container.id = "wibm_bulk_move_wi_container";
    container.appendChild(wrapper);
    container.appendChild(selectWISource);
    container.appendChild(selectSourceEntries);

    $(selectWISource).on("change", function() {
        selectedWorldIndex = this.value === "" ? -1 : Number(this.value);
    });

    /** Init entry selector. */
    const observer = new IntersectionObserver((entries, observer) => {
        let isVisible = false;

        for (const entry of entries) if (entry.isIntersecting) isVisible = true;
        if (!isVisible) return;

        observer.disconnect();

        // @ts-ignore
        $(selectSourceEntries).select2({
            placeholder: 'Select an option',
            data: [sourceEntriesDefaultOption, ...entriesData.sort((a, b) => a.order - b.order)],
            dropdownParent: $('dialog.popup.popup--animation-fast[open]'),
            closeOnSelect: false,
            scrollAfterSelect: false,
        });
        $(selectSourceEntries).val(selectedWorldEntries);
        $(selectSourceEntries).trigger('change');
    });

    observer.observe(container);

    return {
        popupConfirm: await callGenericPopup(container, POPUP_TYPE.CONFIRM, "", {
                okButton: t`Copy`,
                cancelButton: t`Cancel`,
                customButtons: [
                    { text: t`Delete`, classes: ['popup-button-ok'], result: 3 },
                    { text: t`Transfer`, classes: ['popup-button-ok'], result: 2 },
                ],
            }),
        selectedWorldIndex,
        selectedWorldEntries,
    };
}

/** Adds extension buttons and their listeners. */
function initFeatures() {
    $('#world_apply_current_sorting').after(`
        <div id="wibm_bulk_move_wi_entries" class="menu_button fa-solid fa-boxes-packing interactable" title="Copy all entries into another lorebook" data-i18n="[title]Copy all entries into another lorebook" tabindex="0">
        </div>
    `);

    // TODO: I hate this code, it's still a little bulky. FUCK JQUERY.
    $('#wibm_bulk_move_wi_entries').on('click', async function (e) {
        const currentIndex = Number($('#world_editor_select').val());
        const sourceWorld = world_names[currentIndex];
        const sourceWorldData =  await loadWorldInfo(sourceWorld);

        log("wibm_bulk_move_wi_entries.on(change)", sourceWorldData);

        // @ts-ignore
        if (!sourceWorldData) return toastr.error(t`Lorebook was not selected or does not exist`);

        const sourceWorldEntries = sourceWorldData.entries;
        const { popupConfirm, selectedWorldIndex, selectedWorldEntries } = await createBulkMoverPopup(sourceWorld, sourceWorldEntries);

        log("popupConfirm =", popupConfirm);

        if (!popupConfirm) return;
        // @ts-ignore
        if (selectedWorldIndex === -1 && popupConfirm !== 3) return toastr.warning(t`Please select a target lorebook`);
        // @ts-ignore
        if (selectedWorldEntries.length === 0) return toastr.warning(t`Please select lorebook entries`);

        const selectedValue = world_names[selectedWorldIndex];

        // @ts-ignore
        if (!selectedValue && popupConfirm !== 3) return toastr.warning(t`Target lorebook does not exist`);

        /** Filter selected entries to copy. */
        let filteredEntries = [];
        const arraySourceWorldEntries = Object.values(sourceWorldEntries)

        log(selectedWorldEntries, !selectedWorldEntries.includes("-1"), sourceWorldEntries, arraySourceWorldEntries);

        if (!selectedWorldEntries.includes("-1")) {
            for (const key of selectedWorldEntries)
                filteredEntries.push(arraySourceWorldEntries.find((entry) => entry.uid === Number(key)));
        } else filteredEntries = [...arraySourceWorldEntries];

        filteredEntries = filteredEntries.sort((a, b) => a.displayIndex - b.displayIndex);

        log("filteredEntries =", filteredEntries);

        if (popupConfirm === 1) await bulkCloneWIEntries(sourceWorld, selectedValue, filteredEntries);
        if (popupConfirm === 2) await bulkTransferWIEntries(sourceWorld, selectedValue, filteredEntries);
        if (popupConfirm === 3) await bulkDeleteWIEntries(sourceWorld, filteredEntries);
    });
}

// * Methods in charge of controlling the extension settings

const settingsCallbacks = {
    /**	Triggers on debug setting change. */
    debug: () => {
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
    console.debug("[" + extensionName + "]", `Debug mode is ${extensionSettings.debug ? "active" : "not active"}`);
    console.debug("[" + extensionName + "]", structuredClone(extensionSettings));
}

/** Append settings menu on ST and set listeners. */
async function loadHTMLSettings() {
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

    $("#extensions_settings").append(settingsHtml);

    // Event Listeners for the extension HTML
    $("#wibm-activate-debug").on("input", settingsBooleanButton);
    $("#wibm-check-configuration").on("click", displaySettings);

    log("loadHTMLSettings");
}

/** Init setting values on the menu */
function setSettings() {
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
