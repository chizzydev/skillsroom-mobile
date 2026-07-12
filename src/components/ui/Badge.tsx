import { StyleSheet, Text } from "react-native";
import { colors, radius } from "../../constants/theme";

export function Badge({ children, tone = "cyan" }: { children: string; tone?: "cyan" | "green" | "amber" | "red" | "dark" }) {
  return <Text style={[styles.badge, styles[tone]]}>{children}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  cyan: {
    backgroundColor: colors.cyanSoft,
    borderColor: "#aeefff",
    color: "#0898b8"
  },
  green: {
    backgroundColor: colors.greenSoft,
    borderColor: "#b6f4db",
    color: colors.greenDark
  },
  amber: {
    backgroundColor: colors.amberSoft,
    borderColor: "#ffdf9d",
    color: colors.amber
  },
  red: {
    backgroundColor: colors.redSoft,
    borderColor: "#ffc6d0",
    color: colors.red
  },
  dark: {
    backgroundColor: colors.navySoft,
    borderColor: "#22344b",
    color: colors.white
  }
});
