# Release signing for the subscriber app.
#
# DO NOT COMMIT A REAL KEYSTORE OR ITS PASSWORDS. `keystore.properties` and
# *.jks are gitignored. The debug build uses the standard Android debug key, so
# `gradlew assembleDebug` works with no setup at all.
#
# ---------------------------------------------------------------------------
# One-time setup
# ---------------------------------------------------------------------------
#   keytool -genkeypair -v \
#     -keystore upload-keystore.jks \
#     -alias upload \
#     -keyalg RSA -keysize 4096 -validity 10000
#
# Then create android/keystore.properties:
#
#   storeFile=../upload-keystore.jks
#   storePassword=<store password>
#   keyAlias=upload
#   keyPassword=<key password>
#
# Keep that file and the .jks somewhere safe and backed up. If you lose the key
# you cannot update the app on the Play Store without a new app listing.
#
# ---------------------------------------------------------------------------
# Producing the Play Store upload bundle
# ---------------------------------------------------------------------------
#   npm run build                # rebuild the web bundle
#   npx cap sync android          # copy it into the Android project
#   cd android
#   gradlew.bat bundleRelease     # -> app/build/outputs/bundle/release/app-release.aab
#
# Upload that .aab to the Play Console. Test builds use:
#   gradlew.bat bundleDebug
