# Android release signing

Skillsroom Android release APKs must be signed with the dedicated Skillsroom release key. Do not ship APKs signed with `debug.keystore`; Android treats the signing key as the app identity used for future updates.

Current local signing files:

- Keystore: `android/keystores/skillsroom-release.keystore`
- Signing properties: `android/skillsroom-release.properties`
- Alias: `skillsroom-release`

Both files are inside the ignored native Android folder and must not be committed. Back them up securely before publishing the APK widely. If the keystore is lost, future APKs signed with a new key will not update over this release on user devices.

Release build command:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\HP\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT="C:\Users\HP\AppData\Local\Android\Sdk"
$env:NODE_ENV="production"
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"

cd C:\Users\HP\sr-mobile\android
.\gradlew.bat assembleRelease --console=plain --no-daemon
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.
