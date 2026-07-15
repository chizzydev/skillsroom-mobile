import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { AppButton } from "../../../components/ui/AppButton";
import { colors, radius, spacing } from "../../../constants/theme";
import { uploadEvidenceFile, type EvidenceMimeType, type EvidenceUploadContextType, type UploadedEvidence } from "../../../api/uploads";
import { plainApiError } from "../../../api/errors";

type PickedEvidence = {
  uri: string;
  name?: string;
  mimeType: EvidenceMimeType;
  size?: number;
};

const allowedMimeTypes = new Set<EvidenceMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

function asEvidenceMimeType(value?: string | null): EvidenceMimeType | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return allowedMimeTypes.has(normalized as EvidenceMimeType) ? (normalized as EvidenceMimeType) : null;
}

function mimeFromName(name?: string | null): EvidenceMimeType | null {
  const extension = name?.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "mp4") return "video/mp4";
  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  return null;
}

async function fileSize(uri: string, fallback?: number | null) {
  if (fallback && fallback > 0) return fallback;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === "number" ? info.size : undefined;
}

function uploadErrorMessage(error: unknown) {
  const message = plainApiError(error, "Could not upload this proof.");
  if (message === "Something went wrong." || message === "Something went wrong. Please try again.") {
    return "The file was selected, but the upload did not finish. Check your connection and try again.";
  }
  return message;
}

export function EvidenceUploadField({
  contextType,
  contextId,
  label,
  disabled,
  resetSignal,
  onUploaded
}: {
  contextType: EvidenceUploadContextType;
  contextId: string;
  label: string;
  disabled?: boolean;
  resetSignal?: number;
  onUploaded: (evidence: UploadedEvidence) => void;
}) {
  const [selected, setSelected] = useState<PickedEvidence | null>(null);
  const [uploaded, setUploaded] = useState<UploadedEvidence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSelected(null);
    setUploaded(null);
    setError(null);
    setBusy(false);
  }, [resetSignal]);

  async function uploadPicked(picked: PickedEvidence) {
    setBusy(true);
    setError(null);
    setUploaded(null);
    setSelected(picked);
    try {
      const evidence = await uploadEvidenceFile({
        context_type: contextType,
        context_id: contextId,
        uri: picked.uri,
        mime_type: picked.mimeType,
        original_name: picked.name,
        byte_size: picked.size
      });
      setUploaded(evidence);
      onUploaded(evidence);
    } catch (uploadError) {
      setError(uploadErrorMessage(uploadError));
    } finally {
      setBusy(false);
    }
  }

  async function pickLibraryFile() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Allow photo access to choose proof from your device.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.88,
      allowsMultipleSelection: false
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asEvidenceMimeType(asset.mimeType) ?? mimeFromName(asset.fileName ?? asset.uri);
    if (!mimeType) {
      setError("Choose a JPG, PNG, WEBP, MP4, WEBM, or MOV file.");
      return;
    }

    await uploadPicked({
      uri: asset.uri,
      name: asset.fileName ?? "mobile-evidence",
      mimeType,
      size: await fileSize(asset.uri, asset.fileSize)
    });
  }

  async function pickDocumentFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
      copyToCacheDirectory: true,
      multiple: false
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asEvidenceMimeType(asset.mimeType) ?? mimeFromName(asset.name);
    if (!mimeType) {
      setError("Choose a JPG, PNG, WEBP, MP4, WEBM, or MOV file.");
      return;
    }

    await uploadPicked({
      uri: asset.uri,
      name: asset.name,
      mimeType,
      size: await fileSize(asset.uri, asset.size)
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.actions}>
        <AppButton variant="secondary" disabled={disabled || busy} loading={busy} onPress={pickLibraryFile} style={styles.button}>
          Photos
        </AppButton>
        <AppButton variant="secondary" disabled={disabled || busy} loading={busy} onPress={pickDocumentFile} style={styles.button}>
          Files
        </AppButton>
      </View>
      {selected ? <Text style={styles.meta}>{busy ? "Uploading" : uploaded ? "Selected" : "Selected, not uploaded"}: {selected.name ?? selected.mimeType}</Text> : null}
      {uploaded ? <Text style={styles.success}>Uploaded: {uploaded.evidence_type} proof ready for submission.</Text> : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          {selected && !busy ? (
            <AppButton variant="secondary" onPress={() => void uploadPicked(selected)} style={styles.retryButton}>
              Retry upload
            </AppButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt
  },
  label: {
    color: colors.ink,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  button: {
    flex: 1,
    minHeight: 46
  },
  meta: {
    color: colors.muted,
    fontSize: 13
  },
  success: {
    color: colors.greenDark,
    fontWeight: "800",
    fontSize: 13
  },
  error: {
    color: colors.red,
    fontWeight: "800",
    fontSize: 13
  },
  errorBox: {
    gap: spacing.sm
  },
  retryButton: {
    minHeight: 42
  }
});
