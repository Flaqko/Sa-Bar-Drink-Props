/// <reference path="../../.config/sa.d.ts" />

// ============================================================================
// Bar Drink Props v1.1 - Transition-Safe Release
// GTA San Andreas Classic 1.0 US + CLEO Redux + CLEO+
//
// Stable transition-safe release:
// - Keeps the same drink detection, model, bone, animations, and 1.2s grace.
// - NEVER calls DELETE_RENDER_OBJECT because CJ moved far away.
// - NEVER calls DELETE_RENDER_OBJECT after the host ped vanished.
// - NEVER calls DELETE_RENDER_OBJECT for a dead/removing ped.
// - Polls GTA's active CEntryExit pointer every frame, using the same early
//   transition signal as QuickEntryExitSkip.
// - The instant Entry/Exit becomes active, ALL tracked CLEO+ render-object
//   handles are abandoned WITHOUT deletion and scanning stops immediately.
// - Remains dormant for 1.5 seconds after Entry/Exit clears before scanning
//   or creating any new render objects.
// - Normal, stable animation-end cleanup still explicitly deletes the bottle.
//
// IMPORTANT: [mem] permission is required for the Entry/Exit pointer read.
// ============================================================================

// -----------------------------------------------------------------------------
// Standalone release mode
// -----------------------------------------------------------------------------
// Always enabled while this script is installed.

const PLAYER_ID = 0;

// GTA SA 1.0 US CEntryExitManager active pointer. This is the same early
// transition signal used by QuickEntryExitSkip and BarDrinkingRedux.
const ENTRYEXIT_ACTIVE_PTR_ADDR = 0x96A7D4;
const TRANSITION_SETTLE_MS = 1500;

// Hand-friendly vanilla bottle.
const DRINK_MODEL = 1484; // CJ_BEAR_BOTTLE

const SCAN_RADIUS = 35.0;
const SCAN_INTERVAL_MS = 35;
const MAX_ACTIVE_DRINKERS = 12;

// Grace bridges Barcustom_get -> drinking-loop transitions.
const STOP_GRACE_MS = 1200;

// CLEO+ / GTA HAnim bone ID: BONE_R_HAND.
const RIGHT_HAND_BONE = 24;

const OFFSET_X = 0.0;
const OFFSET_Y = 0.0;
const OFFSET_Z = 0.0;
const ROT_X = 0.0;
const ROT_Y = 0.0;
const ROT_Z = 0.0;

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
let entryExitWasActive = false;
let suspendedUntil = 0;
let nextMaintenanceAt = 0;

function firstNumber(value, preferredKeys) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

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

function getActiveEntryExitPtrSafe() {
    try {
        return Memory.ReadI32(ENTRYEXIT_ACTIVE_PTR_ADDR, false);
    } catch (e) {
        return 0;
    }
}

function abandonAllTrackedDrinkers(reason) {
    const count = activeDrinkers.length;

    // Critical rule for transitions: do NOT touch cached CLEO+ render-object
    // handles. GTA/CLEO+ owns the ped/render cleanup while the interior streams.
    activeDrinkers.length = 0;
    findNextPed = false;

    if (count > 0) {
        log(
            "[BarDrinkProps] Abandoned " + count +
            " tracked bottle(s) WITHOUT DELETE_RENDER_OBJECT" +
            (reason ? " (" + reason + ")" : "") + "."
        );
    }
}

function updateTransitionSafety(now) {
    const ptr = getActiveEntryExitPtrSafe();

    if (ptr > 0) {
        if (!entryExitWasActive) {
            entryExitWasActive = true;
            log(
                "[BarDrinkProps] Entry/Exit active - abandoning render handles " +
                "and suspending prop system."
            );
        }

        if (activeDrinkers.length > 0) {
            abandonAllTrackedDrinkers("Entry/Exit");
        } else {
            findNextPed = false;
        }

        // Extend the settle window while the transition remains active.
        suspendedUntil = Math.max(suspendedUntil, now + TRANSITION_SETTLE_MS);
        return true;
    }

    if (entryExitWasActive) {
        entryExitWasActive = false;
        suspendedUntil = Math.max(suspendedUntil, now + TRANSITION_SETTLE_MS);
        findNextPed = false;
        log(
            "[BarDrinkProps] Entry/Exit cleared - waiting " +
            TRANSITION_SETTLE_MS + "ms before scanning again."
        );
    }

    return now < suspendedUntil;
}

function transitionUnsafeNow() {
    const now = Date.now();
    if (now < suspendedUntil || entryExitWasActive) return true;
    return getActiveEntryExitPtrSafe() > 0;
}

function doesCharExist(ped) {
    return (
        typeof ped === "number" &&
        ped > 0 &&
        !!native("DOES_CHAR_EXIST", ped)
    );
}

function getCharCoordinatesSafe(ped) {
    if (!doesCharExist(ped)) return null;

    try {
        const pos = native("GET_CHAR_COORDINATES", ped);
        if (
            pos &&
            typeof pos.x === "number" && Number.isFinite(pos.x) &&
            typeof pos.y === "number" && Number.isFinite(pos.y) &&
            typeof pos.z === "number" && Number.isFinite(pos.z)
        ) {
            return pos;
        }
    } catch (e) {}

    return null;
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

        // A transition may begin while this model-load loop yields. Abort the
        // creation path immediately and let the main loop handle suspension.
        if (transitionUnsafeNow()) {
            return false;
        }
    }

    return !!native("HAS_MODEL_LOADED", DRINK_MODEL);
}

function deleteRenderObjectSafe(renderObject) {
    if (
        renderObject === null ||
        renderObject === undefined ||
        typeof renderObject !== "number" ||
        !Number.isFinite(renderObject) ||
        renderObject < 0
    ) {
        return false;
    }

    // Last-moment guard. If an Entry/Exit started since the top of the loop,
    // never enter DELETE_RENDER_OBJECT at all.
    if (transitionUnsafeNow()) {
        return false;
    }

    try {
        native("DELETE_RENDER_OBJECT", renderObject);
        return true;
    } catch (e) {
        log("[BarDrinkProps] DELETE_RENDER_OBJECT failed: " + String(e));
        return false;
    }
}

function forgetTrackedDrinker(index, reason) {
    const entry = activeDrinkers[index];
    if (!entry) return;

    activeDrinkers.splice(index, 1);

    if (reason) {
        log(
            "[BarDrinkProps] Forgot bottle handle for ped " +
            entry.ped + " WITHOUT DELETE_RENDER_OBJECT (" + reason + ")."
        );
    }
}

function deleteTrackedDrinkerStable(index, reason) {
    const entry = activeDrinkers[index];
    if (!entry) return;

    // Revalidate everything immediately before touching the CLEO+ handle.
    // If anything looks like removal/transition, abandon instead of deleting.
    if (transitionUnsafeNow()) {
        forgetTrackedDrinker(index, "transition began before normal cleanup");
        return;
    }

    if (!doesCharExist(entry.ped)) {
        forgetTrackedDrinker(index, "host ped vanished");
        return;
    }

    try {
        if (native("IS_CHAR_DEAD", entry.ped)) {
            forgetTrackedDrinker(index, "host ped dead/removing");
            return;
        }
    } catch (e) {
        forgetTrackedDrinker(index, "host ped state unavailable");
        return;
    }

    const deleted = deleteRenderObjectSafe(entry.renderObject);

    // Whether DELETE_RENDER_OBJECT succeeded or threw, never keep retrying the
    // same handle. A repeated delete on a questionable CLEO+ handle is riskier.
    activeDrinkers.splice(index, 1);

    if (deleted && reason) {
        log(
            "[BarDrinkProps] Bottle cleaned normally from ped " +
            entry.ped + " (" + reason + ")."
        );
    } else if (!deleted) {
        log(
            "[BarDrinkProps] Bottle handle forgotten after guarded cleanup for ped " +
            entry.ped + "."
        );
    }
}

function createDrinkRenderObject(ped) {
    if (disabled || transitionUnsafeNow()) return null;
    if (!shouldHaveDrink(ped)) return null;
    if (findTrackedPed(ped) !== -1) return null;
    if (activeDrinkers.length >= MAX_ACTIVE_DRINKERS) return null;

    if (!ensureDrinkModel()) {
        if (!transitionUnsafeNow()) {
            log("[BarDrinkProps] Drink model 1484 failed to load.");
        }
        return null;
    }

    // The model request can yield, so check the transition state again before
    // creating any CLEO+ render object.
    if (transitionUnsafeNow()) return null;

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
            log("[BarDrinkProps] v1.1 disabled safely.");
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

    // If an Entry/Exit somehow began immediately after creation, do NOT try to
    // delete the brand-new handle. Forget it and let streaming own the cleanup.
    if (transitionUnsafeNow()) {
        log(
            "[BarDrinkProps] Transition began immediately after render creation; " +
            "handle abandoned without delete."
        );
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
    if (transitionUnsafeNow()) return;
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
        "[BarDrinkProps] Bottle attached to ped " +
        ped +
        " during " +
        phase +
        " phase."
    );
}

function getPlayerSnapshot() {
    if (transitionUnsafeNow()) return null;

    if (!native("IS_PLAYER_PLAYING", PLAYER_ID)) {
        return null;
    }

    const cj = firstNumber(
        native("GET_PLAYER_CHAR", PLAYER_ID),
        ["handle", "char", "ped"]
    );

    if (!doesCharExist(cj)) {
        return null;
    }

    const pos = getCharCoordinatesSafe(cj);
    if (!pos) {
        return null;
    }

    return {
        ped: cj,
        pos: pos
    };
}

function cleanupTrackedDrinkers(player) {
    const now = Date.now();

    for (let i = activeDrinkers.length - 1; i >= 0; i--) {
        // Never continue cleanup if a transition begins mid-pass.
        if (transitionUnsafeNow()) {
            abandonAllTrackedDrinkers("transition began during cleanup pass");
            return;
        }

        const entry = activeDrinkers[i];

        // Once the host ped has vanished, the CLEO+ render-object handle may
        // already be invalid/freed. Never call DELETE_RENDER_OBJECT here.
        if (!doesCharExist(entry.ped)) {
            forgetTrackedDrinker(i, "host ped vanished");
            continue;
        }

        // Temporary player/loading invalidity is not a reason to touch attached
        // render objects. Leave them alone until a stable frame or transition.
        if (!player) {
            continue;
        }

        // A dead ped may be entering removal at any moment. Do not manually
        // delete an attached CLEO+ render object from this lifecycle state.
        try {
            if (native("IS_CHAR_DEAD", entry.ped)) {
                forgetTrackedDrinker(i, "host ped dead/removing");
                continue;
            }
        } catch (e) {
            forgetTrackedDrinker(i, "host ped state unavailable");
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
            // This is the ONLY normal explicit DELETE_RENDER_OBJECT path:
            // stable player, live ped, no Entry/Exit, animation ended naturally.
            deleteTrackedDrinkerStable(i, "drink animation ended");
        }
    }
}

function scanOneNearbyPed(player) {
    if (disabled || !player || transitionUnsafeNow()) return;

    const ped = firstNumber(
        native(
            "GET_RANDOM_CHAR_IN_SPHERE_NO_SAVE_RECURSIVE",
            player.pos.x,
            player.pos.y,
            player.pos.z,
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

    if (ped !== player.ped && shouldHaveDrink(ped)) {
        trackDrinker(ped);
    }
}

log(
    "[BarDrinkProps] v1.1 loaded - " +
    "per-frame Entry/Exit guard; transition handles are abandoned without DELETE_RENDER_OBJECT."
);

while (true) {
    // Poll Entry/Exit every frame instead of every 35ms so QuickEntryExitSkip's
    // very short transition window is much harder to miss.
    wait(0);

    if (disabled) {
        continue;
    }

    const now = Date.now();

    // This gate intentionally happens before ANY player/ped cleanup or scan.
    if (updateTransitionSafety(now)) {
        continue;
    }

    if (now < nextMaintenanceAt) {
        continue;
    }
    nextMaintenanceAt = now + SCAN_INTERVAL_MS;

    const player = getPlayerSnapshot();

    if (!player) {
        findNextPed = false;
    }

    cleanupTrackedDrinkers(player);

    if (player && !transitionUnsafeNow()) {
        scanOneNearbyPed(player);
    }
}
