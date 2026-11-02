# Offline Vault & Data Preservation Protocol

ResearchLoom is built on an **offline-first, zero-telemetry** architectural foundation.

---

## 🔒 Zero Remote Exfiltration

- All search candidate pools, extracted notes, flow maps, stylus drawings, and downloaded PDF papers remain strictly on your local device.
- No analytics, telemetry, or user documents are sent to any centralized server.
- LLM queries are sent directly from your device to your chosen provider (Google, Anthropic, OpenAI, or Groq) using your own personal API key.

---

## 💾 In-Place APK Upgrades & Android Keystore

When distributing Android applications via APKs outside of Google Play, updating without data loss requires strict signature consistency:

1. **Release Keystore**: All builds are signed with a unified `researchloom-release.keystore` using both **V1 (JAR signature)** and **V2 (Full APK signature scheme)**.
2. **`android:versionCode` Auto-Incrementation**: Allows Android Package Manager to recognize updates cleanly over previous versions without reporting `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
3. **Data Protection Prompt (`hasFragileUserData`)**:
   `AndroidManifest.xml` includes `android:hasFragileUserData="true"`. If a user ever chooses to uninstall the application, Android displays a native checkbox asking whether to keep application data (saving your local SQLite databases and research archives).
