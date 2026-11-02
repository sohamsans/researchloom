package com.sohamsans.researchloom;

import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    /**
     * Intercept and CONSUME hardware stylus button events.
     * On Xiaomi Pad 7 / HyperOS / MIUI, Smart Pen barrel buttons are dispatched
     * as KEYCODE_PAGE_UP (92) and KEYCODE_PAGE_DOWN (93).
     * If unconsumed, the OS long-press triggers default shortcuts like launching
     * Xiaomi Notes (com.miui.notes) or firing the system partial screenshot editor.
     * Consuming these events completely isolates pen button actions to the app canvas,
     * while standard touch gestures (e.g. 3-finger swipe screenshot) continue to work.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        int action = event.getAction();

        // 92 = KEYCODE_PAGE_UP, 93 = KEYCODE_PAGE_DOWN
        if (keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == 92 ||
            keyCode == KeyEvent.KEYCODE_PAGE_DOWN || keyCode == 93) {

            if (action == KeyEvent.ACTION_DOWN) {
                if (event.getRepeatCount() == 0) {
                    if (keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == 92) {
                        dispatchStylusEventToWeb("PageUp");
                    } else {
                        dispatchStylusEventToWeb("PageDown");
                    }
                }
            }
            return true; // Consume event completely to block OEM Notes & Screenshot triggers
        }

        return super.dispatchKeyEvent(event);
    }

    /**
     * Intercept MotionEvents to catch stylus hardware button states (BUTTON_STYLUS_PRIMARY, BUTTON_STYLUS_SECONDARY).
     * Consuming these prevents OEM stylus drag gestures from opening external notes overlays.
     */
    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        int toolType = event.getToolType(0);
        if (toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER) {
            int action = event.getActionMasked();
            int button = event.getActionButton();

            if (action == MotionEvent.ACTION_BUTTON_PRESS) {
                if (button == MotionEvent.BUTTON_STYLUS_PRIMARY || button == MotionEvent.BUTTON_SECONDARY) {
                    dispatchStylusEventToWeb("StylusPrimaryPress");
                    return true;
                } else if (button == MotionEvent.BUTTON_STYLUS_SECONDARY || button == MotionEvent.BUTTON_TERTIARY) {
                    dispatchStylusEventToWeb("StylusSecondaryPress");
                    return true;
                }
            } else if (action == MotionEvent.ACTION_BUTTON_RELEASE) {
                dispatchStylusEventToWeb("StylusButtonRelease");
                return true;
            }
        }
        return super.dispatchGenericMotionEvent(event);
    }

    private void dispatchStylusEventToWeb(String buttonAction) {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.post(() -> {
                    String js = "window.dispatchEvent(new CustomEvent('xiaomi_stylus_button', { detail: { action: '" + buttonAction + "' } }));"
                              + "if (window.handleStylusButton) { window.handleStylusButton('" + buttonAction + "'); }";
                    webView.evaluateJavascript(js, null);
                });
            }
        } catch (Exception e) {
            // Non-critical fallback
        }
    }
}
