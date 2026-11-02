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
     * Intercept hardware keyboard events from styluses like Xiaomi Smart Pen 2 / Focus Pen.
     * Xiaomi stylus barrel buttons map to KEYCODE_PAGE_UP (92) and KEYCODE_PAGE_DOWN (93),
     * or KEYCODE_VOLUME_DOWN. We evaluate JavaScript on the Capacitor WebView so the stylus
     * canvas can switch between Pen and Eraser dynamically.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();
            if (keyCode == KeyEvent.KEYCODE_PAGE_UP || keyCode == 92) {
                dispatchStylusEventToWeb("PageUp");
                return true; // Consume event to prevent scrolling
            } else if (keyCode == KeyEvent.KEYCODE_PAGE_DOWN || keyCode == 93) {
                dispatchStylusEventToWeb("PageDown");
                return true; // Consume event
            }
        }
        return super.dispatchKeyEvent(event);
    }

    /**
     * Intercept MotionEvents to catch stylus hardware button states (BUTTON_STYLUS_PRIMARY, BUTTON_STYLUS_SECONDARY).
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
                } else if (button == MotionEvent.BUTTON_STYLUS_SECONDARY || button == MotionEvent.BUTTON_TERTIARY) {
                    dispatchStylusEventToWeb("StylusSecondaryPress");
                }
            } else if (action == MotionEvent.ACTION_BUTTON_RELEASE) {
                dispatchStylusEventToWeb("StylusButtonRelease");
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
