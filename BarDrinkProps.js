/// <reference path=".config/sa.d.ts" />

// ============================================================================
// Bar Drink Props v1.0
// GTA San Andreas Classic + CLEO Redux + CLEO+
//
// Release build based on the fully tested v0.4 behavior:
// - Uses model 1484 CJ_BEAR_BOTTLE, a vanilla handheld bottle model.
// - Attaches as soon as the customer plays Barcustom_get (receiving drink).
// - Keeps bottle through male/female standing drinking loops.
// - Faster one-ped scanner for much earlier detection.
// - Still uses CLEO+ render-object attachment only: NO ped task injection.
// ============================================================================

const PLAYER_ID = 0;

// Hand-friendly vanilla bottle rather than the static bar/world prop 1486.
const DRINK_MODEL = 1484; // CJ_BEAR_BOTTLE

const SCAN_RADIUS = 35.0;
const SCAN_INTERVAL_MS = 35;
const MAX_ACTIVE_DRINKERS = 12;

// Longer grace bridges the short transition between receiving and drinking.
const STOP_GRACE_MS = 1200;

// CLEO+ / GTA HAnim bone ID: BONE_R_HAND.
const RIGHT_HAND_BONE = 24;

// CJ_BEAR_BOTTLE has a much more suitable handheld pivot than DYN_BEER_1.
// Keep neutral transform for the first hand-model test.
const OFFSET_X = 0.0;
const OFFSET_Y = 0.0;
const OFFSET_Z = 0.0;
const ROT_X = 0.0;
const ROT_Y = 0.0;
const ROT_Z = 0.0;

// Start showing the bottle while the customer actually receives it.
const RECEIVE_ANIMS = [
    "Barcustom_get"
];

const DRINK_ANIMS = [
    "dnk_stndF_loop",
    "dnk_stndM_loop"
];

const activeDrinkers = [];
let findNextPed = false;
let disabled = false;
let warnedCLEOPlus = false;

function firstNumber(value, preferredKeys) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === "number" && Number.isFinite(value[i])) {
                return value[i];
            }
        }
    }

    if (value && typeof value === "object") {
        if (preferredKeys) {
            for (let i = 0; i < preferredKeys.length; i++) {
                const key = preferredKeys[i];
                if (
                    Object.prototype.hasOwnProperty.call(value, key) &&
                    typeof value[key] === "number" &&
                    Number.isFinite(value[key])
                ) {
                    return value[key];
                }
            }
        }

        for (const key in value) {
            if (
                typeof value[key] === "number" &&
                Number.isFinite(value[key])
            ) {
                return value[key];
            }
        }
    }

    return null;
}

function doesCharExist(ped) {
    return (
        typeof ped === "number" &&
        ped > 0 &&
        !!native("DOES_CHAR_EXIST", ped)
    );
}

function isPlayingAny(ped, anims) {
    for (let i = 0; i < anims.length; i++) {
        if (native("IS_CHAR_PLAYING_ANIM", ped, anims[i])) {
            return true;
        }
    }
    return false;
}

function shouldHaveDrink(ped) {
    if (!doesCharExist(ped)) return false;
    if (native("IS_CHAR_DEAD", ped)) return false;

    return (
        isPlayingAny(ped, RECEIVE_ANIMS) ||
        isPlayingAny(ped, DRINK_ANIMS)
    );
}

function findTrackedPed(ped) {
    for (let i = 0; i < activeDrinkers.length; i++) {
        if (activeDrinkers[i].ped === ped) return i;
    }
    return -1;
}

function ensureDrinkModel() {
    if (native("HAS_MODEL_LOADED", DRINK_MODEL)) return true;

    native("REQUEST_MODEL", DRINK_MODEL);

    const deadline = Date.now() + 1200;
    while (
        !native("HAS_MODEL_LOADED", DRINK_MODEL) &&
        Date.now() < deadline
    ) {
        wait(0);
    }

    return !!native("HAS_MODEL_LOADED", DRINK_MODEL);
}

function deleteRenderObjectSafe(renderObject) {
    if (
        renderObject === null ||
        renderObject === undefined ||
        typeof renderObject !== "number"
    ) {
        return;
    }

    try {
        native("DELETE_RENDER_OBJECT", renderObject);
    } catch (e) {
        log("[BarDrinkProps] DELETE_RENDER_OBJECT failed: " + String(e));
    }
}

function createDrinkRenderObject(ped) {
    if (disabled) return null;
    if (!shouldHaveDrink(ped)) return null;
    if (findTrackedPed(ped) !== -1) return null;
    if (activeDrinkers.length >= MAX_ACTIVE_DRINKERS) return null;

    if (!ensureDrinkModel()) {
        log("[BarDrinkProps] Drink model 1484 failed to load.");
        return null;
    }

    let renderObject = null;

    try {
        renderObject = firstNumber(
            native(
                "CREATE_RENDER_OBJECT_TO_CHAR_BONE",
                ped,
                DRINK_MODEL,
                RIGHT_HAND_BONE,
                OFFSET_X,
                OFFSET_Y,
                OFFSET_Z,
                ROT_X,
                ROT_Y,
                ROT_Z
            ),
            ["handle", "renderObject", "object"]
        );
    } catch (e) {
        if (!warnedCLEOPlus) {
            warnedCLEOPlus = true;
            log(
                "[BarDrinkProps] CLEO+ render-object command unavailable/failed: " +
                String(e)
            );
            log("[BarDrinkProps] v1.0 disabled safely.");
        }
        disabled = true;
        return null;
    }

    if (
        renderObject === null ||
        !Number.isFinite(renderObject) ||
        renderObject < 0
    ) {
        log("[BarDrinkProps] CLEO+ returned no valid render-object handle.");
        return null;
    }

    try {
        native(
            "SET_RENDER_OBJECT_AUTO_HIDE",
            renderObject,
            true,
            false,
            true
        );
    } catch (e) {}

    return renderObject;
}

function trackDrinker(ped) {
    if (!shouldHaveDrink(ped)) return;
    if (findTrackedPed(ped) !== -1) return;

    const renderObject = createDrinkRenderObject(ped);
    if (renderObject === null) return;

    activeDrinkers.push({
        ped: ped,
        renderObject: renderObject,
        notHoldingSince: 0
    });

    const phase = isPlayingAny(ped, RECEIVE_ANIMS) ? "receive" : "drink";
    log(
        "[BarDrinkProps] Bottle attached early to ped " +
        ped +
        " during " +
        phase +
        " phase."
    );
}

function cleanupTrackedDrinkers() {
    const now = Date.now();

    for (let i = activeDrinkers.length - 1; i >= 0; i--) {
        const entry = activeDrinkers[i];

        if (!doesCharExist(entry.ped) || native("IS_CHAR_DEAD", entry.ped)) {
            deleteRenderObjectSafe(entry.renderObject);
            activeDrinkers.splice(i, 1);
            continue;
        }

        if (shouldHaveDrink(entry.ped)) {
            entry.notHoldingSince = 0;
            continue;
        }

        if (entry.notHoldingSince === 0) {
            entry.notHoldingSince = now;
            continue;
        }

        if (now - entry.notHoldingSince >= STOP_GRACE_MS) {
            deleteRenderObjectSafe(entry.renderObject);
            activeDrinkers.splice(i, 1);
        }
    }
}

function scanOneNearbyPed() {
    if (disabled) return;

    if (!native("IS_PLAYER_PLAYING", PLAYER_ID)) {
        findNextPed = false;
        return;
    }

    const cj = firstNumber(
        native("GET_PLAYER_CHAR", PLAYER_ID),
        ["handle", "char", "ped"]
    );

    if (!doesCharExist(cj)) {
        findNextPed = false;
        return;
    }

    const pos = native("GET_CHAR_COORDINATES", cj);
    if (
        !pos ||
        typeof pos.x !== "number" ||
        typeof pos.y !== "number" ||
        typeof pos.z !== "number"
    ) {
        findNextPed = false;
        return;
    }

    // One ped per tick remains intentionally conservative, but at 35 ms a
    // complete bar population is revisited much faster than v0.3.
    const ped = firstNumber(
        native(
            "GET_RANDOM_CHAR_IN_SPHERE_NO_SAVE_RECURSIVE",
            pos.x,
            pos.y,
            pos.z,
            SCAN_RADIUS,
            findNextPed,
            true
        ),
        ["handle", "char", "ped"]
    );

    if (ped === null || ped <= 0) {
        findNextPed = false;
        return;
    }

    findNextPed = true;

    if (ped !== cj && shouldHaveDrink(ped)) {
        trackDrinker(ped);
    }
}

log(
    "[BarDrinkProps] v1.0 loaded - early Barcustom_get detection + " +
    "CJ_BEAR_BOTTLE hand prop."
);

while (true) {
    wait(SCAN_INTERVAL_MS);

    if (!disabled) {
        cleanupTrackedDrinkers();
        wait(0);
        scanOneNearbyPed();
    }
}
