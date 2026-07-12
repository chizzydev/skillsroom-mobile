import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../../constants/theme";

export function AppWordmark() {
  return (
    <View style={styles.row}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>SR</Text>
      </View>
      <Text style={styles.name}>Skillsroom</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center"
  },
  logoText: {
    color: colors.green,
    fontWeight: "900"
  },
  name: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  }
});
