package com.sohamsans.researchloom;

import android.os.Bundle;
import android.view.InputDevice;
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
     * Intercept and CONSUME hardware keyboard & stylus button events.
     * On Xiaomi Pad 7 / HyperOS / MIUI, the Smart Pen barrel buttons are dispatched
     * as KEYCODE_PAGE_UP (92) and KEYCODE_PAGE_DOWN (93), or KEYCODE_BUTTON_PRIMARY / SECONDARY.
     * If left unconsumed, long-press gestures trigger OEM default actions like launching
     * Xiaomi Notes (com.miui.notes) or firing the system partial screenshot editor.
     * By consuming the event immediately on KEY_DOWN and generic motion, we prevent
     * the system shortcuts from hijacking the pen while ResearchLoom is in foreground,
     * while leaving normal system touch gestures (e.g. 3-finger swipe down) intact.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        int action = event.getAction();
        boolean isFromStylus = (event.getSource() & InputDevice.SOURCE_STYLUS) != 0 ||
                               (event.getSource() & InputDevice.SOURCE_BLUETOOTH) != 0;

        // Catch Xiaomi Smart Pen buttons & standard stylus keys
        if (keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == 92 ||
            keyCode == KeyEvent.KEYCODE_PAGE_DOWN || keyCode == 93 ||
            keyCode == KeyEvent.KEYCODE_BUTTON_PRIMARY ||
            keyCode == KeyEvent.KEYCODE_BUTTON_SECONDARY ||
            keyCode == KeyEvent.KEYCODE_STYLUS_BUTTON_TAIL ||
            keyCode == KeyEvent.KEYCODE_STYLUS_BUTTON_PRIMARY ||
            keyCode == KeyEvent.KEYCODE_STYLUS_BUTTON_SECONDARY ||
            keyCode == KeyEvent.KEYCODE_STYLUS_BUTTON_TERTIARY) {

            if (action == KeyEvent.ACTION_DOWN) {
                // If it's a repeated event (user holding the button), keep consuming to prevent OS long-press trigger
                if (event.getRepeatCount() == 0) {
                    if (keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == 92 || keyCode == KeyEvent.KEYCODE_BUTTON_PRIMARY) {
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
            int buttonState = event.getButtonState();

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

            // If a stylus button is actively pressed during hover or motion, consume to block OEM overlays
            if ((buttonState & (MotionEvent.BUTTON_STYLUS_PRIMARY | MotionEvent.BUTTON_STYLUS_SECONDARY | MotionEvent.BUTTON_SECONDARY)) != 0) {
                // Handled in webview pointer events
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
